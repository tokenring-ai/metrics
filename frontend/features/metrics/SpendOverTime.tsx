import type { SpendSeries } from "@tokenring-ai/metrics/rpc/schema";
import SectionLabel from "@tokenring-ai/one-frontend/components/ui/SectionLabel.tsx";
import { cn } from "@tokenring-ai/one-frontend/lib/utils.ts";
import { SegmentedControl } from "@tokenring-ai/one-frontend/ui";
import formatError from "@tokenring-ai/utility/error/formatError";
import { type ReactNode, useState } from "react";
import { useSpendSeries } from "../../lib/metricsQueries.ts";
import { formatBucketLabel, formatCount, formatUsd, SPEND_RANGE_OPTIONS, type SpendRangeId } from "./formatters.ts";

type SpendMetric = "cost" | "tokens";

const METRIC_OPTIONS: Array<{ value: SpendMetric; label: string }> = [
  { value: "cost", label: "Cost" },
  { value: "tokens", label: "Tokens" },
];

type Bucket = SpendSeries["buckets"][number];

function bucketValue(bucket: Bucket, metric: SpendMetric): number {
  return metric === "cost" ? bucket.cost : bucket.inputTokens + bucket.outputTokens;
}

function formatValue(value: number, metric: SpendMetric): string {
  return metric === "cost" ? formatUsd(value) : `${formatCount(value)} tok`;
}

function bucketSummary(bucket: Bucket, range: SpendRangeId): string {
  return `${formatBucketLabel(bucket.t, range)}: ${formatUsd(bucket.cost)} · ${formatCount(bucket.inputTokens)} in / ${formatCount(bucket.outputTokens)} out · ${formatCount(bucket.requests)} req`;
}

/**
 * Column chart of spend per time bucket, drawn with the same CSS bars as the
 * rest of the Metrics views. Covers live agents plus every stored agent, so
 * it spans sessions when a MetricsStorage provider is installed.
 */
export function SpendChart({ series, metric }: { series: SpendSeries; metric: SpendMetric }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const values = series.buckets.map(b => bucketValue(b, metric));
  const max = Math.max(0, ...values);
  const total = metric === "cost" ? series.totals.cost : series.totals.inputTokens + series.totals.outputTokens;
  const active = hovered !== null ? series.buckets[hovered] : undefined;
  const first = series.buckets[0];
  const middle = series.buckets[Math.floor(series.buckets.length / 2)];
  const last = series.buckets.at(-1);

  return (
    <div data-testid="metrics-spend-chart">
      <div className="flex items-baseline justify-between gap-3 mb-2 min-h-5">
        <span className="text-xs text-muted tabular-nums truncate" data-testid="metrics-spend-readout">
          {active ? bucketSummary(active, series.range) : `${formatValue(total, metric)} in range · ${formatCount(series.totals.requests)} requests`}
        </span>
        <span className="text-xs text-muted tabular-nums shrink-0" title="Largest bucket">
          max {formatValue(max, metric)}
        </span>
      </div>
      <div
        className="h-28 flex items-end gap-px border-b border-primary"
        role="img"
        aria-label={`Spend over the last ${series.range}: ${formatValue(total, metric)} across ${series.buckets.length} buckets`}
        onMouseLeave={() => setHovered(null)}
      >
        {series.buckets.map((bucket, index) => {
          const value = values[index]!;
          const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0;
          return (
            <div
              key={bucket.t}
              className="flex-1 h-full flex items-end min-w-0"
              title={bucketSummary(bucket, series.range)}
              onMouseEnter={() => setHovered(index)}
              data-testid="metrics-spend-bar"
            >
              <div
                className={cn(
                  "w-full rounded-t-sm transition-all duration-500",
                  metric === "cost" ? "bg-emerald-500/80" : "bg-sky-500/80",
                  hovered === index && "opacity-70",
                )}
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between gap-2 mt-1 text-xs text-muted tabular-nums">
        <span>{first ? formatBucketLabel(first.t, series.range) : ""}</span>
        <span className="hidden sm:inline">{middle ? formatBucketLabel(middle.t, series.range) : ""}</span>
        <span>{last ? formatBucketLabel(last.t, series.range) : ""}</span>
      </div>
    </div>
  );
}

/** Spend-over-time card for the overview: range + metric selectors around {@link SpendChart}. */
export default function SpendOverTime() {
  const [range, setRange] = useState<SpendRangeId>("24h");
  const [metric, setMetric] = useState<SpendMetric>("cost");
  const series = useSpendSeries(range);

  let body: ReactNode;
  if (series.data) {
    body = <SpendChart series={series.data} metric={metric} />;
  } else if (series.error) {
    body = (
      <p className="text-xs text-danger py-8 text-center" role="alert">
        Unable to load spend history: {formatError(series.error, { includeStack: false }).split("\n")[0]}
      </p>
    );
  } else {
    body = <div className="h-36 rounded-lg bg-tertiary/50 animate-pulse" role="status" aria-label="Loading spend history" />;
  }

  return (
    <section className="bg-secondary border border-primary rounded-xl p-4 shadow-sm" data-testid="metrics-spend-over-time">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <SectionLabel>Spend over time</SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl value={metric} onChange={setMetric} options={METRIC_OPTIONS} ariaLabel="Chart metric" size="sm" />
          <SegmentedControl value={range} onChange={setRange} options={[...SPEND_RANGE_OPTIONS]} ariaLabel="Time range" size="sm" />
        </div>
      </div>
      {body}
    </section>
  );
}
