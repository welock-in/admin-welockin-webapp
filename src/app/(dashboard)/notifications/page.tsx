"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import { Card, PageHeader, Badge } from "@/components/ui";

/* Backend shapes (/api/admin/notifications/*). */
type SendResult = { audience: string; recipients: number; sent: number; failed: number; invalid: number; pruned: number; deduped: number };
type Delivery = { id: string; userId: string | null; title: string; body: string; status: string; source: string; createdAt: string };
type Template = { id: string; key: string; title: string; body: string; data: unknown; category: string; sound: string | null; active: boolean; createdAt: string };
type Rule = { id: string; name: string; event: string; condition: unknown; templateKey: string; audience: unknown; dedupeKeyTemplate: string | null; enabled: boolean; priority: number; createdAt: string };
type Tab = "send" | "templates" | "rules";

const inputCls = "w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-ink/40";
const labelCls = "block text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5";
const btnDark = "rounded-xl bg-accent text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-40";
const btnGhost = "rounded-xl border border-black/10 text-sm font-semibold px-3 py-1.5 text-ink hover:bg-black/[0.03]";

export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>("send");
  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="Notifications"
        subtitle="Send a push, and manage the data-driven templates + rules."
        right={
          <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1">
            {(["send", "templates", "rules"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold capitalize transition ${tab === t ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />
      {tab === "send" ? <SendTab /> : tab === "templates" ? <TemplatesTab /> : <RulesTab />}
    </div>
  );
}

// ── Send ────────────────────────────────────────────────────────────────────────

function SendTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"all" | "user">("all");
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ deliveries: Delivery[] }>("admin/notifications/deliveries?take=30");
      setDeliveries(r.deliveries);
    } catch {
      setDeliveries([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const canSend = title.trim() && body.trim() && !busy && (mode === "all" || userId.trim());

  async function send() {
    if (!canSend) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const audience = mode === "all" ? { mode: "all" } : { mode: "user", userId: userId.trim() };
      const r = await apiSend<SendResult>("admin/notifications/send", "POST", { audience, title: title.trim(), body: body.trim() });
      setResult(r);
      setTitle("");
      setBody("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="text-sm font-bold text-ink mb-4">Compose</h2>
        <label className={labelCls}>Audience</label>
        <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1 mb-4 w-max">
          {(["all", "user"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${mode === m ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
              {m === "all" ? "All users" : "One user"}
            </button>
          ))}
        </div>
        {mode === "user" && (
          <div className="mb-4">
            <label className={labelCls}>User id</label>
            <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Mongo _id" className={inputCls} />
          </div>
        )}
        <div className="mb-4">
          <label className={labelCls}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Your computer locked" className={inputCls} />
        </div>
        <div className="mb-4">
          <label className={labelCls}>Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} rows={3} placeholder="Tap to start a focus session." className={`${inputCls} resize-none`} />
        </div>
        <button onClick={send} disabled={!canSend} className={btnDark}>{busy ? "Sending…" : "Send"}</button>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        {result && (
          <p className="text-sm text-muted mt-3">
            Sent to <b className="text-ink">{result.sent}</b> / {result.recipients} device(s)
            {result.failed > 0 && <> · {result.failed} failed</>}
            {result.invalid > 0 && <> · {result.invalid} invalid</>}
            {result.recipients === 0 && " — no registered devices yet"}
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-bold text-ink mb-4">Recent deliveries</h2>
        {deliveries === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-muted">No notifications sent yet.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[440px] overflow-y-auto">
            {deliveries.map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-3 border-b border-black/5 pb-2 last:border-0">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{d.title}</div>
                  <div className="text-xs text-muted truncate">{d.body}</div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-none">
                  <Badge tone={d.status === "sent" ? "green" : d.status === "invalid" ? "amber" : "red"}>{d.status}</Badge>
                  <span className="text-[11px] text-muted">{timeAgo(d.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── JSON textarea helper ──────────────────────────────────────────────────────

function jsonToText(v: unknown): string {
  if (v === null || v === undefined) return "";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "";
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

const EMPTY_TEMPLATE = { key: "", title: "", body: "", category: "system", dataText: "", active: true };

function TemplatesTab() {
  const [items, setItems] = useState<Template[] | null>(null);
  const [form, setForm] = useState({ ...EMPTY_TEMPLATE });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ templates: Template[] }>("admin/notifications/templates");
      setItems(r.templates);
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function edit(t: Template) {
    setEditId(t.id);
    setForm({ key: t.key, title: t.title, body: t.body, category: t.category, dataText: jsonToText(t.data), active: t.active });
    setError("");
  }
  function reset() {
    setEditId(null);
    setForm({ ...EMPTY_TEMPLATE });
    setError("");
  }

  async function save() {
    setError("");
    let data: unknown = undefined;
    if (form.dataText.trim()) {
      try {
        data = JSON.parse(form.dataText);
      } catch {
        setError("Invalid JSON in Data payload");
        return;
      }
    }
    setBusy(true);
    try {
      if (editId) {
        await apiSend(`admin/notifications/templates/${editId}`, "PATCH", { title: form.title, body: form.body, category: form.category, active: form.active, ...(data !== undefined ? { data } : {}) });
      } else {
        await apiSend("admin/notifications/templates", "POST", { key: form.key, title: form.title, body: form.body, category: form.category, active: form.active, ...(data !== undefined ? { data } : {}) });
      }
      reset();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await apiSend(`admin/notifications/templates/${id}`, "DELETE");
    if (editId === id) reset();
    load();
  }

  const canSave = form.title.trim() && form.body.trim() && (editId || form.key.trim()) && !busy;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="p-5">
        <h2 className="text-sm font-bold text-ink mb-4">Templates</h2>
        {items === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">No templates yet — create one on the right.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 border border-black/5 rounded-xl px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-bold text-ink">{t.key}</code>
                    <Badge tone={t.active ? "green" : "gray"}>{t.active ? "active" : "off"}</Badge>
                    <Badge tone="ink">{t.category}</Badge>
                  </div>
                  <div className="text-sm font-semibold text-ink truncate mt-0.5">{t.title}</div>
                  <div className="text-xs text-muted truncate">{t.body}</div>
                </div>
                <div className="flex gap-2 flex-none">
                  <button onClick={() => edit(t)} className={btnGhost}>Edit</button>
                  <button onClick={() => remove(t.id)} className="rounded-xl border border-red-500/30 text-red-600 text-sm font-semibold px-3 py-1.5 hover:bg-red-50">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 h-max">
        <h2 className="text-sm font-bold text-ink mb-4">{editId ? "Edit template" : "New template"}</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Key {editId && <span className="text-muted normal-case">(immutable)</span>}</label>
            <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} disabled={!!editId} placeholder="pc_locked" className={`${inputCls} disabled:opacity-50`} />
          </div>
          <div>
            <label className={labelCls}>Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Body</label>
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Data (JSON — deep link etc.)</label>
            <textarea value={form.dataText} onChange={(e) => setForm({ ...form, dataText: e.target.value })} rows={4} placeholder='{ "route": "/start-focus", "params": { "source": "desktop" } }' className={`${inputCls} resize-none font-mono text-xs`} />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={!canSave} className={btnDark}>{busy ? "Saving…" : editId ? "Save" : "Create"}</button>
            {editId && <button onClick={reset} className={btnGhost}>Cancel</button>}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Rules ───────────────────────────────────────────────────────────────────────

const EMPTY_RULE = { name: "", event: "", templateKey: "", conditionText: "{}", audienceText: '{ "mode": "sameUserOtherDevices" }', dedupeKeyTemplate: "", enabled: true, priority: 0 };

function RulesTab() {
  const [items, setItems] = useState<Rule[] | null>(null);
  const [form, setForm] = useState({ ...EMPTY_RULE });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ rules: Rule[] }>("admin/notifications/rules");
      setItems(r.rules);
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function edit(r: Rule) {
    setEditId(r.id);
    setForm({ name: r.name, event: r.event, templateKey: r.templateKey, conditionText: jsonToText(r.condition) || "{}", audienceText: jsonToText(r.audience), dedupeKeyTemplate: r.dedupeKeyTemplate ?? "", enabled: r.enabled, priority: r.priority });
    setError("");
  }
  function reset() {
    setEditId(null);
    setForm({ ...EMPTY_RULE });
    setError("");
  }

  async function toggle(r: Rule) {
    await apiSend(`admin/notifications/rules/${r.id}`, "PATCH", { enabled: !r.enabled });
    load();
  }

  async function save() {
    setError("");
    let condition: unknown;
    let audience: unknown;
    try {
      condition = form.conditionText.trim() ? JSON.parse(form.conditionText) : {};
    } catch {
      setError("Invalid JSON in Condition");
      return;
    }
    try {
      audience = JSON.parse(form.audienceText);
    } catch {
      setError("Invalid JSON in Audience");
      return;
    }
    setBusy(true);
    const payload = {
      name: form.name,
      event: form.event,
      templateKey: form.templateKey,
      condition,
      audience,
      dedupeKeyTemplate: form.dedupeKeyTemplate.trim() || null,
      enabled: form.enabled,
      priority: Number(form.priority) || 0,
    };
    try {
      if (editId) await apiSend(`admin/notifications/rules/${editId}`, "PATCH", payload);
      else await apiSend("admin/notifications/rules", "POST", payload);
      reset();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await apiSend(`admin/notifications/rules/${id}`, "DELETE");
    if (editId === id) reset();
    load();
  }

  const canSave = form.name.trim() && form.event.trim() && form.templateKey.trim() && !busy;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="p-5">
        <h2 className="text-sm font-bold text-ink mb-4">Rules</h2>
        {items === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">No rules yet — create one on the right.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border border-black/5 rounded-xl px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink truncate">{r.name}</span>
                    <Badge tone={r.enabled ? "green" : "gray"}>{r.enabled ? "on" : "off"}</Badge>
                  </div>
                  <div className="text-xs text-muted truncate">
                    <code>{r.event}</code> → <code>{r.templateKey}</code>
                  </div>
                </div>
                <div className="flex gap-2 flex-none">
                  <button onClick={() => toggle(r)} className={btnGhost}>{r.enabled ? "Disable" : "Enable"}</button>
                  <button onClick={() => edit(r)} className={btnGhost}>Edit</button>
                  <button onClick={() => remove(r.id)} className="rounded-xl border border-red-500/30 text-red-600 text-sm font-semibold px-3 py-1.5 hover:bg-red-50">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 h-max">
        <h2 className="text-sm font-bold text-ink mb-4">{editId ? "Edit rule" : "New rule"}</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="PC locked → notify phone" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Event</label>
            <input value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} placeholder="session.started" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Template key</label>
            <input value={form.templateKey} onChange={(e) => setForm({ ...form, templateKey: e.target.value })} placeholder="pc_locked" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Condition (JSON)</label>
            <textarea value={form.conditionText} onChange={(e) => setForm({ ...form, conditionText: e.target.value })} rows={3} placeholder='{ "platform": { "$in": ["windows","macos"] } }' className={`${inputCls} resize-none font-mono text-xs`} />
          </div>
          <div>
            <label className={labelCls}>Audience (JSON)</label>
            <textarea value={form.audienceText} onChange={(e) => setForm({ ...form, audienceText: e.target.value })} rows={2} placeholder='{ "mode": "sameUserOtherDevices" }' className={`${inputCls} resize-none font-mono text-xs`} />
          </div>
          <div>
            <label className={labelCls}>Dedupe key template (optional)</label>
            <input value={form.dedupeKeyTemplate} onChange={(e) => setForm({ ...form, dedupeKeyTemplate: e.target.value })} placeholder="pc_locked:{{sessionId}}" className={inputCls} />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Priority</span>
              <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="w-20 rounded-xl border border-black/10 px-2.5 py-1.5 text-sm outline-none focus:border-ink/40" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={!canSave} className={btnDark}>{busy ? "Saving…" : editId ? "Save" : "Create"}</button>
            {editId && <button onClick={reset} className={btnGhost}>Cancel</button>}
          </div>
        </div>
      </Card>
    </div>
  );
}
