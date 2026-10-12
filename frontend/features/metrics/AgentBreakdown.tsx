import type { AgentCosts } from "@tokenring-ai/metrics/rpc/schema";
import SectionLabel from "@tokenring-ai/one-frontend/components/ui/SectionLabel.tsx";
import { cn } from "@tokenring-ai/one-frontend/lib/utils.ts";
import {
  categoryKind,
  categoryShares,
  formatCount,
  formatMs,
  formatPercent,
  formatTps,
  formatUsd,
  STAT_LABEL_TOOLTIPS,
  shortCategoryLabel,
  sumRecord,
  topRecordEntries,
} from "./formatters.ts";
import KeyValueList from "./KeyValueList.tsx";
import ModelTokenTable from "./ModelTokenTable.tsx";

export const KIND_TEXT: Record<ReturnType<typeof categoryKind>, string> = {
  chat: "text-accent",
  image: "text-pink-500",
  video: "text-violet-500",
  other: "text-amber-500",
};

export function MiniStatRow({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {items.map(item => (
        <span key={item.label} className="tabular-nums" title={STAT_LABEL_TOOLTIPS[item.label]}>
          <span className="opacity-70">{item.label}</span> <span className="text-secondary font-medium">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Full metrics breakdown for one agent: costs, per-model tokens, latency
 * (including TTFT percentiles), activity and errors. Shared by the expanded
 * Agent spend row and the History detail view.
 */
export default function AgentBreakdown({ agent }: { agent: AgentCosts }) {
  const allCategories = categoryShares(agent.costs, agent.total);
  const totalErrors = Math.max(sumRecord(agent.errors.errorsByProvider), sumRecord(agent.errors.errorsByType));
  const hasTtft = agent.latency.p50TimeToFirstTokenMs !== undefined;

  return (
    <div className="space-y-4" data-testid="metrics-agent-breakdown">
      <div>
        <SectionLabel className="mb-2">Costs</SectionLabel>
        {allCategories.length > 0 ? (
          <div className="space-y-1.5">
            {allCategories.map(c => (
              <div key={c.category} className="flex items-center justify-between gap-3 text-xs">
                <span className={cn("truncate font-medium", KIND_TEXT[categoryKind(c.category)])} title={c.category}>
                  {shortCategoryLabel(c.category)}
                </span>
                <span className="tabular-nums text-muted shrink-0">
                  {formatUsd(c.amount)}
                  <span className="ml-1.5 opacity-70">{formatPercent(c.share)}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">No recorded costs for this agent.</p>
        )}
      </div>

      <div data-testid="metrics-agent-tokens">
        <SectionLabel className="mb-2">Tokens</SectionLabel>
        <MiniStatRow
          items={[
            { label: "in", value: formatCount(agent.tokens.totalInputTokens) },
            { label: "out", value: formatCount(agent.tokens.totalOutputTokens) },
            { label: "cached", value: formatCount(agent.tokens.totalCachedTokens) },
            { label: "reasoning", value: formatCount(agent.tokens.totalReasoningTokens) },
          ]}
        />
        {Object.keys(agent.tokensByCategory).length > 0 ? (
          <div className="mt-2">
            <ModelTokenTable tokensByCategory={agent.tokensByCategory} costsByCategory={agent.costs} />
          </div>
        ) : null}
      </div>

      <div data-testid="metrics-agent-latency">
        <SectionLabel className="mb-2">Latency</SectionLabel>
        <MiniStatRow
          items={[
            { label: "requests", value: formatCount(agent.latency.requestCount) },
            { label: "avg", value: formatMs(agent.latency.avgElapsedMs) },
            { label: "p50", value: formatMs(agent.latency.p50ElapsedMs) },
            { label: "p95", value: formatMs(agent.latency.p95ElapsedMs) },
            { label: "p99", value: formatMs(agent.latency.p99ElapsedMs) },
            { label: "ttft", value: formatMs(agent.latency.avgTimeToFirstTokenMs) },
            { label: "tps", value: formatTps(agent.latency.avgTokensPerSecond) },
          ]}
        />
        {hasTtft ? (
          <div className="mt-1" data-testid="metrics-agent-ttft">
            <MiniStatRow
              items={[
                { label: "ttft p50", value: formatMs(agent.latency.p50TimeToFirstTokenMs) },
                { label: "ttft p95", value: formatMs(agent.latency.p95TimeToFirstTokenMs) },
                { label: "ttft p99", value: formatMs(agent.latency.p99TimeToFirstTokenMs) },
              ]}
            />
          </div>
        ) : null}
      </div>

      <div data-testid="metrics-agent-activity">
        <SectionLabel className="mb-2">Activity</SectionLabel>
        <MiniStatRow
          items={[
            { label: "steps", value: formatCount(agent.activity.totalSteps) },
            { label: "tool calls", value: formatCount(agent.activity.totalToolCalls) },
          ]}
        />
        {Object.keys(agent.activity.toolCallsByName).length > 0 ? (
          <div className="mt-2">
            <p className="text-xs text-muted mb-1">Top tools</p>
            <KeyValueList entries={topRecordEntries(agent.activity.toolCallsByName, 8)} emptyLabel="No tool calls" />
          </div>
        ) : null}
      </div>

      <div data-testid="metrics-agent-errors">
        <SectionLabel className="mb-2">Errors & retries</SectionLabel>
        <MiniStatRow
          items={[
            { label: "errors", value: formatCount(totalErrors) },
            { label: "retries", value: formatCount(agent.errors.retryCount) },
          ]}
        />
        {totalErrors > 0 ? (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted mb-1">By type</p>
              <KeyValueList entries={topRecordEntries(agent.errors.errorsByType, 5)} emptyLabel="—" />
            </div>
            <div>
              <p className="text-xs text-muted mb-1">By provider</p>
              <KeyValueList entries={topRecordEntries(agent.errors.errorsByProvider, 5)} emptyLabel="—" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
