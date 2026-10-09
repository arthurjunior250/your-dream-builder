import type { Candle, Signal } from "@/lib/signals";

interface Props {
  candles: Candle[];
  signal: Pick<Signal, "entry" | "tp1" | "tp2" | "sl" | "direction" | "decimals">;
}

const W = 640;
const H = 260;
const PAD_R = 64;
const PAD_T = 12;
const PAD_B = 22;

export function CandleChart({ candles, signal }: Props) {
  if (candles.length === 0) return null;

  const levels = [signal.entry, signal.tp1, signal.tp2, signal.sl];
  let min = Math.min(...candles.map((c) => c.low), ...levels);
  let max = Math.max(...candles.map((c) => c.high), ...levels);
  const pad = (max - min) * 0.06 || 1;
  min -= pad;
  max += pad;

  const plotW = W - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const x = (i: number) => (i / candles.length) * plotW;
  const y = (v: number) => PAD_T + ((max - v) / (max - min)) * plotH;
  const bodyW = Math.max(2, (plotW / candles.length) * 0.6);

  const gridValues = Array.from({ length: 5 }, (_, i) => min + ((max - min) * (i + 0.5)) / 5);

  const levelLines = [
    { v: signal.tp2, label: "TP2", color: "var(--color-buy)" },
    { v: signal.tp1, label: "TP1", color: "var(--color-buy)" },
    { v: signal.entry, label: "ENTRY", color: "var(--color-chart-3)" },
    { v: signal.sl, label: "SL", color: "var(--color-sell)" },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Price chart">
      <rect x={0} y={0} width={W} height={H} fill="var(--color-background)" rx={8} />
      {gridValues.map((g, i) => (
        <g key={i}>
          <line x1={0} x2={plotW} y1={y(g)} y2={y(g)} stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="3 4" />
          <text x={plotW + 6} y={y(g) + 3} fill="var(--color-muted-foreground)" fontSize={9} className="font-mono-num">
            {g.toFixed(signal.decimals)}
          </text>
        </g>
      ))}
      {candles.map((c, i) => {
        const up = c.close >= c.open;
        const color = up ? "var(--color-buy)" : "var(--color-sell)";
        const cx = x(i) + bodyW / 2;
        return (
          <g key={c.time}>
            <line x1={cx} x2={cx} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1} />
            <rect
              x={x(i)}
              y={y(Math.max(c.open, c.close))}
              width={bodyW}
              height={Math.max(1, Math.abs(y(c.open) - y(c.close)))}
              fill={color}
            />
          </g>
        );
      })}
      {levelLines.map((l) => (
        <g key={l.label}>
          <line x1={0} x2={plotW} y1={y(l.v)} y2={y(l.v)} stroke={l.color} strokeWidth={1} strokeDasharray="6 4" opacity={0.9} />
          <rect x={plotW + 2} y={y(l.v) - 8} width={PAD_R - 6} height={14} rx={3} fill={l.color} opacity={0.15} />
          <text x={plotW + 8} y={y(l.v) + 3} fill={l.color} fontSize={9} fontWeight={700}>
            {l.label}
          </text>
        </g>
      ))}
      <text x={8} y={H - 8} fill="var(--color-muted-foreground)" fontSize={9}>
        {candles[0]!.time} — {candles[candles.length - 1]!.time} · Daily
      </text>
    </svg>
  );
}
