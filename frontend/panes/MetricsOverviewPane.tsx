import type { CostSummary } from "@tokenring-ai/metrics/rpc/schema";
import EmptyState from "@tokenring-ai/one-frontend/components/ui/EmptyState.tsx";
import ErrorState from "@tokenring-ai/one-frontend/components/ui/ErrorState.tsx";
import LoadingState from "@tokenring-ai/one-frontend/components/ui/LoadingState.tsx";
import SectionLabel from "@tokenring-ai/one-frontend/components/ui/SectionLabel.tsx";
import SummaryStat from "@tokenring-ai/one-frontend/components/ui/SummaryStat.tsx";
import ViewHeader from "@tokenring-ai/one-frontend/components/ui/ViewHeader.tsx";
import ViewShell from "@tokenring-ai/one-frontend/components/ui/ViewShell.tsx";
import { useLiveStreamStatusFromSWR } from "@tokenring-ai/one-frontend/hooks/useLiveStreamStatus.ts";
import { cn } from "@tokenring-ai/one-frontend/lib/utils.ts";
import { useCostSummary } from "@tokenring-ai/one-frontend/rpc.ts";
import formatError from "@tokenring-ai/utility/error/formatError";
import { AlertTriangle, BarChart3, Clock, Coins, DollarSign, Image as ImageIcon, MessageSquare, RefreshCw, Sparkles, Wrench, Zap } from "lucide-react";
import { useMemo } from "react";
import { MiniStatRow } from "../features/metrics/AgentBreakdown.tsx";
import {
  bucketTotals,
  categoryKind,
  categoryShares,
  formatCount,
  formatMs,
  formatPercent,
  formatTps,
  formatUsd,
  LATENCY_TOOLTIP,
  shortCategoryLabel,
  sumRecord,
  TOKENS_TOOLTIP,
  topRecordEntries,
} from "../features/metrics/formatters.ts";
import KeyValueList from "../features/metrics/KeyValueList.tsx";
import { LiveStatusBadge, StaleBanner } from "../features/metrics/LiveStatus.tsx";
import ModelTokenTable from "../features/metrics/ModelTokenTable.tsx";
import SpendOverTime from "../features/metrics/SpendOverTime.tsx";
import { METRICS_GRADIENT } from "../ids.ts";

const KIND_BAR: Record<ReturnType<typeof categoryKind>, string> = {
  chat: "bg-accent",
  image: "bg-pink-500",
  video: "bg-violet-500",
  other: "bg-amber-500",
};

function emptyAgentMetrics(): Pick<CostSummary, "tokens" | "latency" | "errors" | "activity"> {
  return {
    tokens: { totalInputTokens: 0, totalOutputTokens: 0, totalCachedTokens: 0, totalReasoningTokens: 0 },
    latency: { requestCount: 0, avgElapsedMs: 0, avgTimeToFirstTokenMs: 0, avgTokensPerSecond: 0 },
    errors: { errorsByProvider: {}, errorsByType: {}, retryCount: 0 },
    activity: { totalSteps: 0, totalToolCalls: 0, toolCallsByName: {} },
  };
}

function CategoryBars({ totalsByCategory, grandTotal }: { totalsByCategory: Record<string, number>; grandTotal: number }) {
  const shares = categoryShares(totalsByCategory, grandTotal);

  if (shares.length === 0) {
    return (
      <EmptyState
        variant="card"
        icon={BarChart3}
        title="No spend yet"
        hint="Costs appear here as agents chat, generate images, or use other billable tools."
        data-testid="metrics-category-empty"
      />
    );
  }

  return (
    <div className="space-y-2.5" data-testid="metrics-category-bars">
      {shares.map(item => {
        const kind = categoryKind(item.category);
        const pct = Math.max(item.share * 100, item.amount > 0 ? 1.5 : 0);
        return (
          <div key={item.category} className="group">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-xs text-primary font-medium truncate" title={item.category}>
                {shortCategoryLabel(item.category)}
              </span>
              <span className="text-xs text-muted tabular-nums shrink-0">
                {formatUsd(item.amount)}
                <span className="text-muted/70 ml-1.5">{formatPercent(item.share)}</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-tertiary overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", KIND_BAR[kind])}
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={Math.round(item.share * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.category}: ${formatUsd(item.amount)}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={cn("w-2 h-2 rounded-full", color)} />
      {label}
    </span>
  );
}

/**
 * Live totals for the Metrics dashboard: headline spend, performance cards,
 * spend mix and the per-category breakdown. Companion to
 * {@link MetricsAgentsView}, which carries the per-agent table.
 */
export default function MetricsOverviewView() {
  const summary = useCostSummary();
  const streamStatus = useLiveStreamStatusFromSWR(summary);
  const mutateSummary = summary.mutate;

  const data = summary.data;
  const buckets = useMemo(() => bucketTotals(data?.totalsByCategory ?? {}), [data?.totalsByCategory]);

  const totals = useMemo(() => {
    const defaults = emptyAgentMetrics();
    return {
      tokens: data?.tokens ?? defaults.tokens,
      latency: data?.latency ?? defaults.latency,
      errors: data?.errors ?? defaults.errors,
      activity: data?.activity ?? defaults.activity,
    };
  }, [data]);

  const totalErrors = Math.max(sumRecord(totals.errors.errorsByProvider), sumRecord(totals.errors.errorsByType));

  const refreshButton = (
    <button
      type="button"
      onClick={() => void mutateSummary()}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg transition-colors focus-ring cursor-pointer"
      title="Refresh now"
      data-testid="metrics-refresh"
    >
      <RefreshCw className={cn("w-3.5 h-3.5", summary.isValidating && "animate-spin")} />
      Refresh
    </button>
  );

  // One header across loading/error/ready branches so the live badge never flickers away.
  const header = (
    <ViewHeader title="Spend overview" icon={DollarSign} iconGradient={METRICS_GRADIENT} subtitle="Live totals across agents">
      <LiveStatusBadge status={streamStatus.status} showSpinner={streamStatus.showSpinner} />
      {refreshButton}
    </ViewHeader>
  );

  if (summary.isLoading && !data) {
    return (
      <ViewShell header={header} data-testid="metrics-overview-view">
        <LoadingState message="Loading metrics…" size="lg" />
      </ViewShell>
    );
  }
  if (streamStatus.status === "error") {
    return (
      <ViewShell header={header} data-testid="metrics-overview-view">
        <ErrorState
          title="Unable to load metrics"
          error={formatError(summary.error, { includeStack: false }).split("\n")[0]}
          onRetry={() => void mutateSummary()}
          variant="page"
        />
      </ViewShell>
    );
  }
  if (!data) {
    return (
      <ViewShell header={header} data-testid="metrics-overview-view">
        <LoadingState message="Waiting for metrics…" size="md" />
      </ViewShell>
    );
  }

  return (
    <ViewShell pad="page" width="wide" bodyClassName="space-y-5" header={header} data-testid="metrics-overview-view">
      {streamStatus.isStale ? <StaleBanner error={summary.error} /> : null}

      {/* Cost summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryStat
          label="Total since start"
          value={formatUsd(data.grandTotal)}
          sub={`${data.agentCount} agent${data.agentCount === 1 ? "" : "s"} tracked`}
          icon={<DollarSign className="w-4 h-4" />}
          accentClass="text-emerald-500"
          iconPosition="right"
          data-testid="metrics-summary-stat"
        />
        <SummaryStat
          label="Chat & models"
          value={formatUsd(buckets.chat)}
          sub="Chat + structured generation"
          icon={<MessageSquare className="w-4 h-4" />}
          accentClass="text-accent"
          iconPosition="right"
          data-testid="metrics-summary-stat"
        />
        <SummaryStat
          label="Media"
          value={formatUsd(buckets.media)}
          sub="Image + video generation"
          icon={<ImageIcon className="w-4 h-4" />}
          accentClass="text-pink-500"
          iconPosition="right"
          data-testid="metrics-summary-stat"
        />
        <SummaryStat
          label="Active now"
          value={String(data.activeAgentCount)}
          sub={data.agentCount === 0 ? "Start an agent to track spend" : `${data.agentCount - data.activeAgentCount} idle`}
          icon={<Sparkles className="w-4 h-4" />}
          accentClass="text-amber-500"
          iconPosition="right"
          data-testid="metrics-summary-stat"
        />
      </div>

      {/* Performance summary cards */}
      <div className="grid grid-cols-2 gap-3" data-testid="metrics-performance-stats">
        <div title={TOKENS_TOOLTIP} data-testid="metrics-tokens-stat">
          <SummaryStat
            label="Tokens"
            value={`${formatCount(totals.tokens.totalInputTokens)} / ${formatCount(totals.tokens.totalOutputTokens)}`}
            sub={`in / out · cached ${formatCount(totals.tokens.totalCachedTokens)} · reason ${formatCount(totals.tokens.totalReasoningTokens)}`}
            icon={<Coins className="w-4 h-4" />}
            accentClass="text-sky-500"
            iconPosition="right"
            data-testid="metrics-summary-stat"
          />
        </div>
        <div title={LATENCY_TOOLTIP} data-testid="metrics-latency-stat">
          <SummaryStat
            label="Latency"
            value={formatMs(totals.latency.avgElapsedMs)}
            sub={
              totals.latency.requestCount > 0
                ? `${formatCount(totals.latency.requestCount)} req · ttft ${formatMs(totals.latency.avgTimeToFirstTokenMs)} · ${formatTps(totals.latency.avgTokensPerSecond)}`
                : "No requests yet"
            }
            icon={<Clock className="w-4 h-4" />}
            accentClass="text-indigo-500"
            iconPosition="right"
            data-testid="metrics-summary-stat"
          />
        </div>
        <SummaryStat
          label="Errors"
          value={formatCount(totalErrors)}
          sub={`${formatCount(totals.errors.retryCount)} retries across providers`}
          icon={<AlertTriangle className="w-4 h-4" />}
          accentClass="text-rose-500"
          iconPosition="right"
          data-testid="metrics-summary-stat"
        />
        <SummaryStat
          label="Activity"
          value={`${formatCount(totals.activity.totalSteps)} / ${formatCount(totals.activity.totalToolCalls)}`}
          sub="steps / tool calls"
          icon={<Wrench className="w-4 h-4" />}
          accentClass="text-cyan-500"
          iconPosition="right"
          data-testid="metrics-summary-stat"
        />
      </div>

      {totals.latency.requestCount > 0 ? (
        <section className="bg-secondary border border-primary rounded-xl p-4 shadow-sm" data-testid="metrics-latency-percentiles">
          <SectionLabel className="mb-2">Latency percentiles</SectionLabel>
          <div className="space-y-1">
            <MiniStatRow
              items={[
                { label: "p50", value: formatMs(totals.latency.p50ElapsedMs) },
                { label: "p95", value: formatMs(totals.latency.p95ElapsedMs) },
                { label: "p99", value: formatMs(totals.latency.p99ElapsedMs) },
              ]}
            />
            {totals.latency.p50TimeToFirstTokenMs !== undefined ? (
              <MiniStatRow
                items={[
                  { label: "ttft p50", value: formatMs(totals.latency.p50TimeToFirstTokenMs) },
                  { label: "ttft p95", value: formatMs(totals.latency.p95TimeToFirstTokenMs) },
                  { label: "ttft p99", value: formatMs(totals.latency.p99TimeToFirstTokenMs) },
                ]}
              />
            ) : null}
          </div>
          <p className="text-xs text-muted mt-2">Request-weighted across agents, from each agent's last 100 requests.</p>
        </section>
      ) : null}

      <SpendOverTime />

      {/* Stacked overview */}
      {data.grandTotal > 0 ? (
        <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm" data-testid="metrics-spend-mix">
          <SectionLabel className="mb-3">Spend mix</SectionLabel>
          <div className="h-3 rounded-full bg-tertiary overflow-hidden flex">
            {buckets.chat > 0 ? (
              <div
                className="h-full bg-accent transition-all duration-500"
                style={{ width: `${(buckets.chat / data.grandTotal) * 100}%` }}
                title={`Chat ${formatUsd(buckets.chat)}`}
              />
            ) : null}
            {buckets.media > 0 ? (
              <div
                className="h-full bg-pink-500 transition-all duration-500"
                style={{ width: `${(buckets.media / data.grandTotal) * 100}%` }}
                title={`Media ${formatUsd(buckets.media)}`}
              />
            ) : null}
            {buckets.other > 0 ? (
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${(buckets.other / data.grandTotal) * 100}%` }}
                title={`Other ${formatUsd(buckets.other)}`}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            <LegendDot color="bg-accent" label={`Chat & models ${formatUsd(buckets.chat)}`} />
            <LegendDot color="bg-pink-500" label={`Media ${formatUsd(buckets.media)}`} />
            <LegendDot color="bg-amber-500" label={`Other ${formatUsd(buckets.other)}`} />
          </div>
        </div>
      ) : null}

      {/* Errors + top tools overview when present */}
      {totalErrors > 0 || Object.keys(totals.activity.toolCallsByName).length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="metrics-detail-panels">
          {totalErrors > 0 ? (
            <section className="bg-secondary border border-primary rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-3.5 h-3.5 text-rose-500" />
                <SectionLabel>Errors by type</SectionLabel>
              </div>
              <KeyValueList entries={topRecordEntries(totals.errors.errorsByType, 8)} emptyLabel="No errors" />
              {Object.keys(totals.errors.errorsByProvider).length > 0 ? (
                <div className="mt-4 pt-3 border-t border-primary">
                  <p className="text-xs text-muted mb-2">By provider</p>
                  <KeyValueList entries={topRecordEntries(totals.errors.errorsByProvider, 8)} emptyLabel="—" />
                </div>
              ) : null}
            </section>
          ) : null}
          {Object.keys(totals.activity.toolCallsByName).length > 0 ? (
            <section className="bg-secondary border border-primary rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="w-3.5 h-3.5 text-cyan-500" />
                <SectionLabel>Top tools</SectionLabel>
              </div>
              <KeyValueList entries={topRecordEntries(totals.activity.toolCallsByName, 10)} emptyLabel="No tool calls" />
            </section>
          ) : null}
        </div>
      ) : null}

      {/* By category */}
      <section>
        <div className="flex items-center justify-between px-1 mb-3">
          <SectionLabel>By category</SectionLabel>
          <span className="text-xs text-muted">{Object.keys(data.totalsByCategory).length} categories</span>
        </div>
        <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm">
          <CategoryBars totalsByCategory={data.totalsByCategory} grandTotal={data.grandTotal} />
        </div>
      </section>

      {/* Per-model token split */}
      <section>
        <div className="flex items-center justify-between px-1 mb-3">
          <SectionLabel>Tokens by model</SectionLabel>
        </div>
        <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm">
          <ModelTokenTable tokensByCategory={data.tokensByCategory} costsByCategory={data.totalsByCategory} />
        </div>
      </section>

      <p className="text-xs text-muted text-center px-4">
        Metrics are tracked per agent for the current session (and restored from storage when available). Costs and tokens come from model provider usage;
        latency, steps, tool calls, and errors are collected by the chat and AI client layers.
      </p>
    </ViewShell>
  );
}
