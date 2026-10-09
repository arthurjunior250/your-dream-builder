import { useState } from "react";
import { Check, Copy, TrendingDown, TrendingUp } from "lucide-react";
import type { Signal } from "@/lib/signals";
import { CandleChart } from "./CandleChart";

function LevelBox({ label, value, tone }: { label: string; value: string; tone: "entry" | "tp" | "sl" }) {
  const toneClass =
    tone === "tp"
      ? "border-buy/40 bg-buy/10 text-buy"
      : tone === "sl"
        ? "border-sell/40 bg-sell/10 text-sell"
        : "border-chart-3/40 bg-chart-3/10 text-chart-3";
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${toneClass}`}>
      <div className="text-[10px] font-semibold tracking-widest uppercase opacity-80">{label}</div>
      <div className="font-mono-num text-sm font-bold">{value}</div>
    </div>
  );
}

export function SignalCard({ signal }: { signal: Signal }) {
  const [copied, setCopied] = useState(false);
  const isBuy = signal.direction === "buy";
  const fmt = (v: number) => v.toFixed(signal.decimals);
  const time = new Date(signal.generatedAt);

  const copySignal = async () => {
    const text = `${signal.symbol} ${signal.direction.toUpperCase()}\nEntry: ${fmt(signal.entry)}\nTP1: ${fmt(signal.tp1)}\nTP2: ${fmt(signal.tp2)}\nSL: ${fmt(signal.sl)}\nConfidence: ${signal.confidence}%`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <article className="card-glow overflow-hidden rounded-2xl bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${isBuy ? "bg-buy" : "bg-sell"} animate-pulse`} />
          <span className="text-sm font-bold tracking-wide">SignalEdge</span>
          <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
            {signal.category}
          </span>
        </div>
        <div className="text-right">
          <div className="font-mono-num text-sm font-bold">{signal.symbol}</div>
          <div className="text-[10px] text-muted-foreground">
            {time.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}{" "}
            {time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} UTC
          </div>
        </div>
      </header>

      <div className="px-5 pt-4">
        <div
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-lg font-extrabold tracking-widest uppercase ${
            isBuy ? "bg-buy/15 text-buy" : "bg-sell/15 text-sell"
          }`}
        >
          {isBuy ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
          Direction: {signal.direction}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Price at analysis: <span className="font-mono-num font-semibold text-foreground">{fmt(signal.price)}</span>{" "}
          <span className={`font-mono-num font-semibold ${signal.changePct >= 0 ? "text-buy" : "text-sell"}`}>
            ({signal.changePct >= 0 ? "+" : ""}
            {signal.changePct}%)
          </span>
        </p>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <LevelBox label="Entry" value={fmt(signal.entry)} tone="entry" />
          <LevelBox label="TP1" value={fmt(signal.tp1)} tone="tp" />
          <LevelBox label="TP2" value={fmt(signal.tp2)} tone="tp" />
          <LevelBox label="SL" value={fmt(signal.sl)} tone="sl" />
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold tracking-widest text-muted-foreground uppercase">Confidence</span>
            <span className="font-mono-num font-bold text-primary">{signal.confidence}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-chart-3 via-primary to-buy transition-all"
              style={{ width: `${signal.confidence}%` }}
            />
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <CandleChart candles={signal.candles} signal={signal} />
        </div>

        <div className="mt-4 space-y-3">
          <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Strategic Analysis Description
          </h3>
          {signal.analysis.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </div>
      </div>

      <footer className="mt-5 flex items-center justify-between border-t border-border px-5 py-3">
        <span className="text-[10px] text-muted-foreground">Not financial advice · End-of-day data</span>
        <button
          onClick={copySignal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy Signal"}
        </button>
      </footer>
    </article>
  );
}
