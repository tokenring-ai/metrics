import type { AgentHistoryItem } from "@tokenring-ai/metrics/rpc/schema";
import AsyncListBody from "@tokenring-ai/one-frontend/components/ui/AsyncListBody.tsx";
import SearchInput from "@tokenring-ai/one-frontend/components/ui/SearchInput.tsx";
import { useDashboardApi } from "@tokenring-ai/one-frontend/dock/DashboardApiContext.tsx";
import { cn } from "@tokenring-ai/one-frontend/lib/utils.ts";
import { Button, EmptyState, ViewHeader, ViewShell } from "@tokenring-ai/one-frontend/ui";
import { ArrowDown, ArrowUp, Download, History, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { historyCsvColumns } from "../features/metrics/csvColumns.ts";
import { formatAgentIdShort, formatCount, formatRelativeTime, formatUsd, type HistorySort, sortHistory } from "../features/metrics/formatters.ts";
import { downloadCsv } from "../lib/csv.ts";
import { useMetricsHistory } from "../lib/metricsQueries.ts";
import { METRICS_AGENT_DETAIL_VIEW_ID } from "../manifest.ts";

const COLUMNS: Array<{ id: HistorySort; label: string; numeric: boolean }> = [
  { id: "name", label: "Agent", numeric: false },
  { id: "spend", label: "Spend", numeric: true },
  { id: "tokens", label: "Tokens", numeric: true },
  { id: "requests", label: "Requests", numeric: true },
  { id: "updated", label: "Updated", numeric: true },
];

function matches(row: AgentHistoryItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return row.displayName.toLowerCase().includes(q) || row.agentType.toLowerCase().includes(q) || row.agentId.toLowerCase().includes(q);
}

/**
 * Cross-session metrics History: every agent with stored metrics plus every
 * running agent, sortable by column, with CSV export. Clicking a row opens
 * that agent's {@link MetricsAgentDetailView}.
 */
export default function MetricsHistoryView() {
  const api = useDashboardApi();
  const history = useMetricsHistory();
  const [sort, setSort] = useState<HistorySort>("updated");
  const [ascending, setAscending] = useState(false);
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () =>
      sortHistory(
        (history.data?.items ?? []).filter(row => matches(row, query)),
        sort,
        ascending,
      ),
    [history.data?.items, query, sort, ascending],
  );

  const onSort = (id: HistorySort) => {
    if (id === sort) setAscending(a => !a);
    else {
      setSort(id);
      setAscending(false);
    }
  };

  const header = (
    <ViewHeader title="History" dashboardId="metrics" subtitle="Agents across sessions">
      <Button
        variant="secondary"
        icon={Download}
        onClick={() => downloadCsv("metrics-history", rows, historyCsvColumns)}
        disabled={rows.length === 0}
        title="Download the rows shown (current search and sort) as CSV"
        data-testid="metrics-history-export"
      >
        CSV
      </Button>
    </ViewHeader>
  );

  const totalItems = history.data?.items.length ?? 0;

  return (
    <ViewShell scroll={false} header={header} data-testid="metrics-history-view">
      {history.data && !history.data.persisted ? (
        <p
          className="mx-3 mt-2 px-3 py-2 text-xs text-muted bg-tertiary/60 border border-primary rounded-lg"
          role="note"
          data-testid="metrics-history-unpersisted"
        >
          No metrics storage is configured, so only running agents are listed. Install a storage plugin such as bun-storage to keep history across sessions.
        </p>
      ) : null}
      <div className="px-3 py-2 border-b border-primary">
        <SearchInput value={query} onChange={setQuery} placeholder="Filter history…" aria-label="Filter history" />
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <AsyncListBody
          isLoading={history.isLoading}
          error={history.error}
          hasItems={totalItems > 0}
          onRetry={() => void history.mutate()}
          loadingMessage="Loading history…"
          errorTitle="Unable to load history"
          emptyIcon={History}
          emptyTitle="No metrics history yet"
          emptyHint="Agents appear here once they record spend, tokens or activity."
        >
          {rows.length === 0 ? (
            <EmptyState variant="compact" icon={Search} title="No matching agents" hint="Try a different search." />
          ) : (
            <table className="w-full text-xs tabular-nums" data-testid="metrics-history-table">
              <thead className="sticky top-0 bg-secondary z-10">
                <tr className="text-muted border-b border-primary">
                  {COLUMNS.map(col => {
                    const active = sort === col.id;
                    // Natural direction: names ascend, numbers and dates descend; `ascending` flips it.
                    const ariaSort = active ? ((col.id === "name") !== ascending ? "ascending" : "descending") : "none";
                    const Arrow = ariaSort === "ascending" ? ArrowUp : ArrowDown;
                    return (
                      <th key={col.id} scope="col" aria-sort={ariaSort} className={cn("font-medium px-3 py-2", col.numeric ? "text-right" : "text-left")}>
                        <button
                          type="button"
                          onClick={() => onSort(col.id)}
                          className={cn("inline-flex items-center gap-1 rounded focus-ring cursor-pointer hover:text-primary", active && "text-primary")}
                        >
                          {col.label}
                          {active ? <Arrow className="w-3 h-3" aria-hidden="true" /> : null}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/60">
                {rows.map(row => (
                  <tr key={row.agentId} className="hover:bg-hover/40 transition-colors" data-testid="metrics-history-row">
                    <td className="px-3 py-2 max-w-[16rem]">
                      <button
                        type="button"
                        onClick={() => api.openView(METRICS_AGENT_DETAIL_VIEW_ID, { agentId: row.agentId }, { position: "right" })}
                        className="block w-full min-w-0 text-left rounded focus-ring cursor-pointer"
                        title="Show full breakdown"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium text-primary truncate">{row.displayName}</span>
                          {row.live ? (
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500" role="img" aria-label="Running" title="Running now" />
                          ) : null}
                        </span>
                        <span className="block text-muted truncate">
                          {row.agentType}
                          <span className="mx-1 opacity-40">·</span>
                          <span className="font-mono opacity-80">{formatAgentIdShort(row.agentId)}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right text-primary font-medium">{formatUsd(row.totalCost)}</td>
                    <td className="px-3 py-2 text-right text-secondary" title={`${row.totalInputTokens} in / ${row.totalOutputTokens} out`}>
                      {formatCount(row.totalInputTokens + row.totalOutputTokens)}
                    </td>
                    <td className="px-3 py-2 text-right text-secondary">{formatCount(row.requestCount)}</td>
                    <td className="px-3 py-2 text-right text-muted" title={new Date(row.updatedAt).toLocaleString()}>
                      {row.live ? "now" : formatRelativeTime(row.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AsyncListBody>
      </div>
    </ViewShell>
  );
}
