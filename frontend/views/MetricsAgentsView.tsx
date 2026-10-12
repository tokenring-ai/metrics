import type { AgentCosts } from "@tokenring-ai/metrics/rpc/schema";
import EmptyState from "@tokenring-ai/one-frontend/components/ui/EmptyState.tsx";
import ErrorState from "@tokenring-ai/one-frontend/components/ui/ErrorState.tsx";
import FilterTabs from "@tokenring-ai/one-frontend/components/ui/FilterTabs.tsx";
import LoadingState from "@tokenring-ai/one-frontend/components/ui/LoadingState.tsx";
import SearchInput from "@tokenring-ai/one-frontend/components/ui/SearchInput.tsx";
import { toastManager } from "@tokenring-ai/one-frontend/components/ui/toast.tsx";
import ViewHeader from "@tokenring-ai/one-frontend/components/ui/ViewHeader.tsx";
import ViewShell from "@tokenring-ai/one-frontend/components/ui/ViewShell.tsx";
import { useOpenAgentChat } from "@tokenring-ai/one-frontend/dock/useOpenAgentChat.ts";
import { useConfirmDialog } from "@tokenring-ai/one-frontend/hooks/useConfirmDialog.tsx";
import { useExpandedSet } from "@tokenring-ai/one-frontend/hooks/useExpandedSet.ts";
import { type FilterTabDefinition, useFilterTabs } from "@tokenring-ai/one-frontend/hooks/useFilterTabs.ts";
import { useLiveStreamStatusFromSWR } from "@tokenring-ai/one-frontend/hooks/useLiveStreamStatus.ts";
import { cn } from "@tokenring-ai/one-frontend/lib/utils.ts";
import { metricsRPCClient, useCostSummary } from "@tokenring-ai/one-frontend/rpc.ts";
import { Button, Select } from "@tokenring-ai/one-frontend/ui";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Activity, ChevronDown, ChevronRight, Download, Loader2, Pause, RotateCcw, Search } from "lucide-react";
import { memo, type ReactNode, useCallback, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import AgentBreakdown, { KIND_TEXT, MiniStatRow } from "../features/metrics/AgentBreakdown.tsx";
import { agentsCsvColumns } from "../features/metrics/csvColumns.ts";
import {
  AGENT_SORT_OPTIONS,
  type AgentFilter,
  type AgentSort,
  categoryKind,
  categoryShares,
  filterAgents,
  formatAgentIdShort,
  formatCount,
  formatMs,
  formatUsd,
  shortCategoryLabel,
  sortAgents,
  sumRecord,
} from "../features/metrics/formatters.ts";
import { LiveStatusBadge, StaleBanner } from "../features/metrics/LiveStatus.tsx";
import { downloadCsv } from "../lib/csv.ts";
import { isMetricsKey } from "../lib/metricsQueries.ts";

type AgentMetricsRow = AgentCosts;

const AGENT_TAB_DEFS: FilterTabDefinition<AgentMetricsRow, AgentFilter>[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active", predicate: a => !a.idle },
  { id: "idle", label: "Idle", predicate: a => a.idle },
];

const AgentCostRow = memo(function AgentCostRow({
  agent,
  maxTotal,
  onReset,
  resetting,
  expanded,
  onToggleExpand,
}: {
  agent: AgentMetricsRow;
  maxTotal: number;
  onReset: (agentId: string) => void;
  resetting: boolean;
  expanded: boolean;
  onToggleExpand: (agentId: string) => void;
}) {
  const openAgentChat = useOpenAgentChat();
  const barWidth = maxTotal > 0 ? Math.max((agent.total / maxTotal) * 100, agent.total > 0 ? 2 : 0) : 0;
  const allCategories = categoryShares(agent.costs, agent.total);
  const topCategories = allCategories.slice(0, 3);
  const hasMore = allCategories.length > 3;
  const totalErrors = Math.max(sumRecord(agent.errors.errorsByProvider), sumRecord(agent.errors.errorsByType));
  const hasPerformance =
    agent.tokens.totalInputTokens > 0 ||
    agent.tokens.totalOutputTokens > 0 ||
    agent.latency.requestCount > 0 ||
    agent.activity.totalSteps > 0 ||
    agent.activity.totalToolCalls > 0 ||
    totalErrors > 0 ||
    agent.errors.retryCount > 0;

  const canReset = agent.total > 0 || hasPerformance;

  return (
    <div className="px-4 py-3 border-b border-primary last:border-b-0 hover:bg-hover/40 transition-colors" data-testid="metrics-agent-row">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggleExpand(agent.agentId)}
          className="mt-0.5 p-0.5 text-muted hover:text-primary rounded focus-ring cursor-pointer shrink-0"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse cost breakdown" : "Expand cost breakdown"}
          title={expanded ? "Collapse" : "Show full breakdown"}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <button type="button" onClick={() => openAgentChat(agent.agentId)} className="flex-1 min-w-0 text-left focus-ring rounded-md cursor-pointer">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-primary truncate">{agent.displayName}</span>
            {agent.idle ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted shrink-0">
                <Pause className="w-2.5 h-2.5" /> Idle
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                <Activity className="w-2.5 h-2.5 animate-pulse" /> Active
              </span>
            )}
          </div>
          <p className="text-xs text-muted truncate mb-2">
            {agent.agentType}
            <span className="mx-1.5 opacity-40">·</span>
            <span className="font-mono opacity-80">{formatAgentIdShort(agent.agentId)}</span>
          </p>
          <div className="h-1.5 rounded-full bg-tertiary overflow-hidden mb-2">
            <div className="h-full rounded-full bg-emerald-500/80 transition-all duration-500" style={{ width: `${barWidth}%` }} />
          </div>
          {!expanded ? (
            <div className="space-y-1.5">
              {topCategories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {topCategories.map(c => (
                    <span
                      key={c.category}
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded-md bg-tertiary/80 border border-primary/60 truncate max-w-[12rem]",
                        KIND_TEXT[categoryKind(c.category)],
                      )}
                      title={c.category}
                    >
                      {shortCategoryLabel(c.category)} {formatUsd(c.amount)}
                    </span>
                  ))}
                  {hasMore ? <span className="text-xs text-muted self-center">+{allCategories.length - 3} more</span> : null}
                </div>
              ) : (
                <span className="text-xs text-muted">No recorded costs</span>
              )}
              {hasPerformance ? (
                <MiniStatRow
                  items={[
                    {
                      label: "tok",
                      value: `${formatCount(agent.tokens.totalInputTokens)}↓ ${formatCount(agent.tokens.totalOutputTokens)}↑`,
                    },
                    ...(agent.latency.requestCount > 0
                      ? [
                          { label: "req", value: formatCount(agent.latency.requestCount) },
                          { label: "avg", value: formatMs(agent.latency.avgElapsedMs) },
                        ]
                      : []),
                    ...(agent.activity.totalSteps > 0 ? [{ label: "steps", value: formatCount(agent.activity.totalSteps) }] : []),
                    ...(agent.activity.totalToolCalls > 0 ? [{ label: "tools", value: formatCount(agent.activity.totalToolCalls) }] : []),
                    ...(totalErrors > 0 ? [{ label: "err", value: formatCount(totalErrors) }] : []),
                  ]}
                />
              ) : null}
            </div>
          ) : null}
        </button>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-sm font-semibold tabular-nums text-primary">{formatUsd(agent.total)}</span>
          <button
            type="button"
            disabled={resetting || !canReset}
            onClick={() => onReset(agent.agentId)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-primary border border-primary rounded-md transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Reset metrics for this agent"
            data-testid="metrics-reset-agent"
          >
            {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            Reset
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 ml-6 pl-3 border-l border-primary">
          <AgentBreakdown agent={agent} />
        </div>
      ) : null}
    </div>
  );
});

/**
 * Per-agent spend for the Metrics dashboard: filter tabs, search and
 * expandable cost breakdowns. Clicking a row opens that agent's chat (docked
 * when the dashboard is attached, otherwise via the `/agent/:id` deep link).
 */
export default function MetricsAgentsView() {
  const summary = useCostSummary();
  const streamStatus = useLiveStreamStatusFromSWR(summary);
  const mutateSummary = summary.mutate;
  const [agentSort, setAgentSort] = useState<AgentSort>("spend");
  const [resettingId, setResettingId] = useState<string | null>(null);
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { isExpanded, toggle: toggleExpand } = useExpandedSet();

  const data = summary.data;
  const maxAgentTotal = useMemo(() => Math.max(0, ...(data?.agents.map(a => a.total) ?? [0])), [data?.agents]);

  const agentsWithMetrics = useMemo((): AgentMetricsRow[] => data?.agents ?? [], [data?.agents]);

  const filteredAgents = useMemo(
    () => sortAgents(filterAgents(agentsWithMetrics, agentFilter, searchQuery), agentSort),
    [agentsWithMetrics, agentFilter, searchQuery, agentSort],
  );

  const { tabs: agentTabs } = useFilterTabs(agentsWithMetrics, AGENT_TAB_DEFS);

  const handleResetRequest = useCallback(
    async (agentId: string) => {
      if (resettingId) return;
      const agent = agentsWithMetrics.find(a => a.agentId === agentId);
      const displayName = agent?.displayName ?? agentId;
      const total = agent?.total ?? 0;
      const confirmed = await openConfirm({
        title: "Reset metrics?",
        message: `Clear all recorded costs, tokens, latency, errors, and activity for “${displayName}” (${formatUsd(total)})? This only resets session counters — it does not refund provider usage.`,
        confirmText: "Reset metrics",
        cancelText: "Cancel",
        variant: "warning",
      });
      if (!confirmed) return;
      setResettingId(agentId);
      try {
        const result = await metricsRPCClient.resetAgentCosts({ agentId });
        if (result.status === "agentNotFound") {
          toastManager.error("Agent no longer exists", { duration: 4000 });
        } else {
          toastManager.success("Metrics reset", { duration: 2500 });
        }
        // Refresh either way: clear counters or drop a ghost agent row.
        await mutateSummary();
      } catch (err) {
        toastManager.error(formatError(err, { includeStack: false }), { duration: 5000 });
      } finally {
        setResettingId(null);
      }
    },
    [agentsWithMetrics, mutateSummary, openConfirm, resettingId],
  );

  const { mutate: mutateCache } = useSWRConfig();
  const [resettingAll, setResettingAll] = useState(false);
  const fleetTotal = data?.grandTotal ?? 0;
  const handleResetAll = useCallback(async () => {
    if (resettingAll) return;
    const count = agentsWithMetrics.length;
    const confirmed = await openConfirm({
      title: "Reset metrics for all agents?",
      message: `Clear recorded costs, tokens, latency, errors, activity and spend history for all ${count} running agent${count === 1 ? "" : "s"} (${formatUsd(fleetTotal)}). Stored records for these agents are deleted too; agents that are no longer running keep their history. This does not refund provider usage.`,
      confirmText: "Reset all agents",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (!confirmed) return;
    setResettingAll(true);
    try {
      const result = await metricsRPCClient.resetAllAgentCosts({});
      toastManager.success(`Metrics reset for ${result.resetCount} agent${result.resetCount === 1 ? "" : "s"}`, { duration: 2500 });
      await Promise.all([mutateSummary(), mutateCache(isMetricsKey)]);
    } catch (err) {
      toastManager.error(formatError(err, { includeStack: false }), { duration: 5000 });
    } finally {
      setResettingAll(false);
    }
  }, [agentsWithMetrics.length, fleetTotal, mutateCache, mutateSummary, openConfirm, resettingAll]);

  const handleExport = useCallback(() => {
    downloadCsv("metrics-agents", filteredAgents, agentsCsvColumns);
  }, [filteredAgents]);

  let body: ReactNode;
  if (summary.isLoading && !data) {
    body = <LoadingState message="Loading metrics…" size="lg" />;
  } else if (summary.error && !data) {
    body = (
      <ErrorState
        title="Unable to load agent spend"
        error={formatError(summary.error, { includeStack: false }).split("\n")[0]}
        onRetry={() => void mutateSummary()}
        variant="page"
      />
    );
  } else if (!data) {
    body = <LoadingState message="Waiting for metrics…" size="md" />;
  } else if (agentsWithMetrics.length === 0) {
    body = (
      <EmptyState
        icon={Activity}
        title="No agents running"
        hint="Create an agent to start tracking costs for this session."
        data-testid="metrics-agents-empty"
      />
    );
  } else {
    body = (
      <>
        <FilterTabs tabs={agentTabs} value={agentFilter} onChange={setAgentFilter} showZeroCounts className="px-2" />
        {streamStatus.isStale ? <StaleBanner error={summary.error} className="mx-3 mt-2" /> : null}
        <div className="px-3 py-2 border-b border-primary flex items-center gap-2">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Filter agents…" aria-label="Filter agents" className="flex-1 min-w-0" />
          <Select
            value={agentSort}
            onChange={value => setAgentSort(value as AgentSort)}
            className="shrink-0"
            aria-label="Sort agents by"
            data-testid="metrics-agent-sort"
          >
            {AGENT_SORT_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>
                Sort: {option.label}
              </option>
            ))}
          </Select>
        </div>
        {filteredAgents.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={Search}
            title="No matching agents"
            hint="Try a different filter or search."
            data-testid="metrics-agents-filtered-empty"
          />
        ) : (
          filteredAgents.map(agent => (
            <AgentCostRow
              key={agent.agentId}
              agent={agent}
              maxTotal={maxAgentTotal}
              onReset={handleResetRequest}
              resetting={resettingId === agent.agentId}
              expanded={isExpanded(agent.agentId)}
              onToggleExpand={toggleExpand}
            />
          ))
        )}
      </>
    );
  }

  return (
    <ViewShell
      scroll={false}
      header={
        <ViewHeader title="Agent spend" dashboardId="metrics" subtitle="Per-agent cost, tokens and errors">
          <LiveStatusBadge status={streamStatus.status} showSpinner={streamStatus.showSpinner} />
          <Button
            variant="secondary"
            icon={Download}
            onClick={handleExport}
            disabled={filteredAgents.length === 0}
            title="Download the agents shown (current filter and sort) as CSV"
            data-testid="metrics-agents-export"
          >
            CSV
          </Button>
          <Button
            variant="secondary"
            icon={RotateCcw}
            onClick={() => void handleResetAll()}
            busy={resettingAll}
            disabled={agentsWithMetrics.length === 0 || fleetTotal + (data?.latency.requestCount ?? 0) + (data?.activity.totalSteps ?? 0) === 0}
            title="Reset metrics for every running agent"
            data-testid="metrics-reset-all"
          >
            Reset all
          </Button>
        </ViewHeader>
      }
      data-testid="metrics-agents-view"
    >
      <div className="flex-1 min-h-0 overflow-y-auto">{body}</div>
      <ConfirmDialog />
    </ViewShell>
  );
}
