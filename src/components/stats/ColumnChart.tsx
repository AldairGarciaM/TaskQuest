"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { compact, niceMax } from "./chart-utils";

export interface ChartSeries<K extends string> {
  key: K;
  label: string;
  color: string;
}

export interface ChartColumn<K extends string> {
  key: string;
  /** Short axis label ("28 oct", "Lun"). */
  label: string;
  /** Tooltip / table heading ("mié 28 oct"). */
  title: string;
  values: Record<K, number>;
}

interface ColumnChartProps<K extends string> {
  columns: ChartColumn<K>[];
  /** Stacked bottom to top in this order; one series draws plain columns with no legend. */
  series: ChartSeries<K>[];
  unit: string;
  /** Names the chart for screen readers and the table caption. */
  title: string;
  /** Show every n-th axis label (the last one is always shown). */
  labelEvery?: number;
  height?: number;
}

const GAP = 2;

export default function ColumnChart<K extends string>({
  columns,
  series,
  unit,
  title,
  labelEvery = 1,
  height = 200,
}: ColumnChartProps<K>) {
  const [active, setActive] = useState<number | null>(null);
  const totals = columns.map((c) => series.reduce((n, s) => n + c.values[s.key], 0));
  const max = niceMax(Math.max(...totals, 0));
  const ticks = [max, max / 2, 0];
  const stacked = series.length > 1;
  const peak = totals.indexOf(Math.max(...totals));

  return (
    <figure className="space-y-3">
      {stacked && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300" aria-label="Leyenda">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: s.color }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        {/* Y axis */}
        <div className="relative w-8 shrink-0 text-right text-[11px] text-slate-500 tabular-nums" style={{ height }} aria-hidden>
          {ticks.map((tick, i) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / 2) * 100}%` }}>
              {compact(tick)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }} onPointerLeave={() => setActive(null)}>
            {ticks.map((tick, i) => (
              <div
                key={tick}
                className="absolute inset-x-0 h-px bg-slate-800"
                style={{ top: `${(i / 2) * 100}%` }}
                aria-hidden
              />
            ))}

            <ol className="absolute inset-0 flex items-end" aria-label={title}>
              {columns.map((column, index) => {
                const total = totals[index];
                const visible = series.filter((s) => column.values[s.key] > 0);
                const summary = `${column.title}: ${total} ${unit}${
                  stacked && total > 0
                    ? ` (${visible.map((s) => `${s.label} ${column.values[s.key]}`).join(", ")})`
                    : ""
                }`;
                return (
                  <li
                    key={column.key}
                    tabIndex={0}
                    aria-label={summary}
                    onPointerEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                    className="group relative flex h-full flex-1 cursor-default items-end justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                  >
                    {/* Hover wash marks the hit target, which is the whole slot, not just the bar. */}
                    <span
                      className={cn("absolute inset-0 rounded-md transition-colors duration-100", active === index && "bg-slate-800/50")}
                      aria-hidden
                    />
                    <span
                      className="relative flex w-full max-w-6 flex-col-reverse"
                      style={{ height: `${(total / max) * 100}%`, gap: visible.length > 1 ? GAP : 0 }}
                      aria-hidden
                    >
                      {visible.map((s, i) => (
                        <span
                          key={s.key}
                          className={cn(i === visible.length - 1 && "rounded-t-[4px]")}
                          style={{ flexGrow: column.values[s.key], flexBasis: 0, backgroundColor: s.color }}
                        />
                      ))}
                    </span>
                    {/* Direct label only on the peak column. */}
                    {index === peak && total > 0 && (
                      <span
                        className="absolute text-[11px] font-semibold text-slate-200 tabular-nums"
                        style={{ bottom: `calc(${(total / max) * 100}% + 4px)` }}
                        aria-hidden
                      >
                        {compact(total)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>

            {active !== null && (
              <Tooltip
                column={columns[active]}
                total={totals[active]}
                series={series}
                unit={unit}
                left={((active + 0.5) / columns.length) * 100}
              />
            )}
          </div>

          <div className="mt-2 flex" aria-hidden>
            {columns.map((column, index) => (
              <span key={column.key} className="flex-1 text-center text-[11px] whitespace-nowrap text-slate-500">
                {index % labelEvery === 0 || index === columns.length - 1 ? column.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="group text-sm">
        <summary className="cursor-pointer text-xs text-slate-400 select-none hover:text-slate-200">Ver como tabla</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-slate-900 text-slate-400">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Periodo
                </th>
                {stacked &&
                  series.map((s) => (
                    <th key={s.key} scope="col" className="px-3 py-2 text-right font-medium">
                      {s.label}
                    </th>
                  ))}
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Total ({unit})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200 tabular-nums">
              {columns.map((column, index) => (
                <tr key={column.key}>
                  <th scope="row" className="px-3 py-1.5 font-normal text-slate-300">
                    {column.title}
                  </th>
                  {stacked &&
                    series.map((s) => (
                      <td key={s.key} className="px-3 py-1.5 text-right">
                        {column.values[s.key]}
                      </td>
                    ))}
                  <td className="px-3 py-1.5 text-right font-semibold">{totals[index]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

interface TooltipProps<K extends string> {
  column: ChartColumn<K>;
  total: number;
  series: ChartSeries<K>[];
  unit: string;
  /** Column center, % of the plot width. */
  left: number;
}

function Tooltip<K extends string>({ column, total, series, unit, left }: TooltipProps<K>) {
  // Keep it inside the plot near the edges.
  const shift = left < 20 ? "0%" : left > 80 ? "-100%" : "-50%";

  return (
    <div
      role="presentation"
      className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow-lg shadow-black/40"
      style={{ left: `${left}%`, transform: `translate(${shift}, -8px)` }}
    >
      <p className="text-slate-400">{column.title}</p>
      <p className="mt-0.5 text-base font-semibold text-slate-50 tabular-nums">
        {total} <span className="text-xs font-normal text-slate-400">{unit}</span>
      </p>
      {series.length > 1 && (
        <ul className="mt-1.5 space-y-0.5">
          {[...series].reverse().map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
              <span className="font-semibold text-slate-100 tabular-nums">{column.values[s.key]}</span>
              <span className="text-slate-400">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
