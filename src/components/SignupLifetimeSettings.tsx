"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { Badge, Card } from "@/components/ui";
import type {
  SignupLifetimeSettings as Settings,
  SignupLifetimeSettingsResult,
} from "@/lib/types";

const offers = [
  { key: "iosSignupLifetimeEnabled", label: "iOS / iPadOS", scope: "Lifetime access on iPhone and iPad." },
  { key: "desktopSignupLifetimeEnabled", label: "Windows + macOS", scope: "Lifetime access shared across Windows and Mac." },
] as const;

type OfferKey = (typeof offers)[number]["key"];

/** A missing or unexpected response is unknown, never an implicit OFF. */
function settingsFrom(result: SignupLifetimeSettingsResult): Settings {
  const settings = result?.settings;
  if (
    !settings ||
    typeof settings.iosSignupLifetimeEnabled !== "boolean" ||
    typeof settings.desktopSignupLifetimeEnabled !== "boolean"
  ) {
    throw new Error("The server did not return the saved offer settings.");
  }
  return settings;
}

export default function SignupLifetimeSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pending, setPending] = useState<string | null>("Loading settings…");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  // Also guards clicks before React has rendered the disabled state.
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending("Loading settings…");
    setError("");
    setSaved("");
    setSettings(null);
    try {
      setSettings(settingsFrom(await apiGet<SignupLifetimeSettingsResult>("admin/signup-lifetime")));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the offer settings.");
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(key: OfferKey, label: string) {
    if (!settings || inFlight.current) return;
    inFlight.current = true;
    const enabled = !settings[key];
    setPending(`Saving ${label}…`);
    setError("");
    setSaved("");
    try {
      // Send only the changed field; another operator may have edited the other offer.
      const next = settingsFrom(await apiSend<SignupLifetimeSettingsResult>(
        "admin/signup-lifetime", "PATCH", { [key]: enabled },
      ));
      setSettings(next);
      setSaved(`${label} offer saved ${next[key] ? "ON" : "OFF"}.`);
    } catch (e) {
      // The write may have succeeded even if its response was lost. Do not show
      // the previous value as current or let a retry invert an unknown value.
      setSettings(null);
      setError(`${e instanceof Error ? e.message : "Could not confirm the change."} Reload settings to check the saved state.`);
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 flex-wrap px-5 py-4 border-b border-black/5">
        <h2 className="text-sm font-bold text-ink">Lifetime on the house</h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={pending !== null}
          className="rounded-xl border border-black/10 px-3.5 py-2 text-sm font-semibold text-ink disabled:opacity-50 hover:bg-black/[0.03]"
        >
          Reload settings
        </button>
      </div>

      <div className="p-5">
        <p className="text-sm text-muted max-w-3xl">
          Only new accounts created while an offer is ON reserve lifetime access.
          Access starts after email verification. New accounts created with a verified Apple email qualify immediately.
          Existing accounts are not upgraded.
        </p>

        <div className="min-h-6 mt-4 text-sm" aria-live="polite" role="status">
          {pending && <span className="text-muted">{pending}</span>}
          {!pending && saved && <span className="text-emerald-700">{saved}</span>}
        </div>
        {error && <p role="alert" className="text-sm text-accent mb-4">{error}</p>}

        {settings ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
              {offers.map(({ key, label, scope }) => (
                <div key={key} className="rounded-xl border border-black/10 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-ink">{label}</h3>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings[key]}
                      aria-label={`${label} lifetime offer`}
                      aria-describedby={`${key}-description`}
                      disabled={pending !== null}
                      onClick={() => void toggle(key, label)}
                      className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${settings[key] ? "bg-emerald-100 text-emerald-800" : "bg-black/5 text-muted"}`}
                    >
                      <span aria-hidden="true" className={`relative inline-flex h-5 w-9 rounded-full ${settings[key] ? "bg-emerald-600" : "bg-black/20"}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${settings[key] ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                      </span>
                      {settings[key] ? "ON" : "OFF"}
                    </button>
                  </div>
                  <p id={`${key}-description`} className="text-sm text-muted mt-3">{scope}</p>
                  <div className="mt-3">
                    <Badge tone={settings[key] ? "green" : "gray"}>
                      {settings[key] ? "Future signups reserve lifetime" : "Future signups follow normal access rules"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-4">
              {settings.updatedAt
                ? `Last changed ${fmtDate(settings.updatedAt)}${settings.updatedBy ? ` by ${settings.updatedBy}` : ""}.`
                : "No changes recorded. Both offers start OFF."}
            </p>
          </>
        ) : !pending ? (
          <p className="text-sm text-muted">The saved state is unavailable. Reload settings before making a change.</p>
        ) : null}

        <div className="mt-5 border-t border-black/5 pt-4 space-y-2 text-sm text-muted">
          <p>Turning an offer OFF stops reservations for future signups. Previously reserved offers and lifetime grants remain valid.</p>
          <p>Each offer applies only to its listed platforms. Purchases and subscriptions stay separate; these switches do not stop existing subscription charges.</p>
        </div>
      </div>
    </Card>
  );
}
