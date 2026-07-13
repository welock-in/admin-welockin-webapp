// Dependency-free SVG charts.

export function BarChart({
  data,
  height = 120,
  color = "#A42B1B",
  format,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = 4;
  const n = data.length || 1;

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => {
          const h = Math.round((d.value / max) * (height - 4));
          return (
            <div key={i} className="flex-1 flex flex-col justify-end items-center group relative" style={{ minWidth: 0 }}>
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: Math.max(d.value > 0 ? 3 : 0, h),
                  background: color,
                  opacity: d.value > 0 ? 1 : 0.15,
                  marginLeft: gap / 2,
                  marginRight: gap / 2,
                }}
                title={`${d.label}: ${format ? format(d.value) : d.value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-muted truncate" style={{ minWidth: 0 }}>
            {n <= 14 || i % 3 === 0 ? d.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sparkbars({
  values,
  color = "#A42B1B",
  height = 40,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t"
          style={{ height: Math.max(v > 0 ? 2 : 0, (v / max) * height), background: color, opacity: v > 0 ? 0.9 : 0.15 }}
        />
      ))}
    </div>
  );
}
