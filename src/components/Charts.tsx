"use client";

// Лёгкие SVG-графики без внешних библиотек.

import { useState } from "react";

export function LineChart({ points, height = 180, max = 100, suffix = "%" }: { points: { x: string; y: number; label?: string }[]; height?: number; max?: number; suffix?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <p className="py-8 text-center text-sm text-graphite">Пока нет данных</p>;
  const W = 600, H = height, pl = 34, pr = 12, pt = 12, pb = 26;
  const iw = W - pl - pr, ih = H - pt - pb;
  const px = (i: number) => pl + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const py = (v: number) => pt + ih - (Math.max(0, Math.min(max, v)) / max) * ih;
  const path = points.map((p, i) => `${i ? "L" : "M"}${px(i)},${py(p.y)}`).join(" ");
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * max));
  const step = Math.ceil(points.length / 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {grid.map((g) => (
        <g key={g}>
          <line x1={pl} x2={W - pr} y1={py(g)} y2={py(g)} className="stroke-line" strokeWidth={1} />
          <text x={pl - 6} y={py(g) + 4} textAnchor="end" className="fill-graphite font-mono text-[10px]">{g}</text>
        </g>
      ))}
      <path d={`${path} L${px(points.length - 1)},${py(0)} L${px(0)},${py(0)} Z`} className="fill-ink/[0.06]" />
      <path d={path} fill="none" className="stroke-ink" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
          <circle cx={px(i)} cy={py(p.y)} r={12} fill="transparent" />
          <circle cx={px(i)} cy={py(p.y)} r={hover === i ? 5 : 3.5} className="fill-paper stroke-ink" strokeWidth={2} />
          {(i % step === 0 || i === points.length - 1) && <text x={px(i)} y={H - 8} textAnchor="middle" className="fill-graphite font-mono text-[10px]">{p.x}</text>}
        </g>
      ))}
      {hover != null && (
        <g pointerEvents="none">
          <rect x={Math.min(W - 160, Math.max(0, px(hover) - 80))} y={Math.max(0, py(points[hover].y) - 38)} width={160} height={26} rx={13} className="fill-ink" />
          <text x={Math.min(W - 80, Math.max(80, px(hover)))} y={Math.max(0, py(points[hover].y) - 38) + 17} textAnchor="middle" className="fill-paper font-mono text-[11px]">
            {(points[hover].label ? points[hover].label + ": " : "") + Math.round(points[hover].y) + suffix}
          </text>
        </g>
      )}
    </svg>
  );
}

export function BarChart({ bars, height = 200, format = (v: number) => String(Math.round(v)) }: {
  bars: { label: string; value: number; value2?: number }[]; height?: number; format?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!bars.length) return <p className="py-8 text-center text-sm text-graphite">Пока нет данных</p>;
  const W = 600, H = height, pb = 24, pt = 20;
  const max = Math.max(1, ...bars.map((b) => Math.max(b.value, b.value2 ?? 0)));
  const bw = W / bars.length;
  const h = (v: number) => (v / max) * (H - pb - pt);
  const two = bars.some((b) => b.value2 != null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <line x1={0} x2={W} y1={H - pb} y2={H - pb} className="stroke-ink" />
      {bars.map((b, i) => {
        const w = Math.min(46, bw * 0.6) / (two ? 2 : 1);
        const x0 = i * bw + bw / 2 - (two ? w : w / 2);
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
            <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
            <rect x={x0} y={H - pb - h(b.value)} width={w} height={h(b.value)} rx={4} className="fill-ink" />
            {two && <rect x={x0 + w + 2} y={H - pb - h(b.value2 ?? 0)} width={w} height={h(b.value2 ?? 0)} rx={4} className="fill-ink/25" />}
            <text x={i * bw + bw / 2} y={H - 7} textAnchor="middle" className="fill-graphite text-[10px]">{b.label}</text>
            {hover === i && (
              <text x={i * bw + bw / 2} y={Math.max(12, H - pb - h(Math.max(b.value, b.value2 ?? 0)) - 6)} textAnchor="middle" className="fill-ink font-mono text-[11px] font-medium">
                {format(b.value)}{two ? ` / ${format(b.value2 ?? 0)}` : ""}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Горизонтальные полосы — результаты по темам */
export function HBars({ rows, threshold }: { rows: { label: string; value: number; sub?: string }[]; threshold?: number }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-graphite">Пока нет данных</p>;
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="mb-0.5 flex justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="num shrink-0 text-graphite">{Math.round(r.value)}%{r.sub ? ` · ${r.sub}` : ""}</span>
          </div>
          <div className="relative h-2.5 rounded-full bg-mist">
            <div className={`h-full rounded-full ${r.value >= (threshold ?? 70) ? "bg-ink" : r.value >= 50 ? "hatch ring-1 ring-inset ring-ink/60" : "bg-signal"}`} style={{ width: `${Math.min(100, r.value)}%` }} />
            {threshold != null && <div className="absolute top-[-2px] h-3 w-px bg-ink" style={{ left: `${threshold}%` }} />}
          </div>
        </div>
      ))}
    </div>
  );
}
