import ErrorState from "@tokenring-ai/one-frontend/components/ui/ErrorState.tsx";
import LoadingState from "@tokenring-ai/one-frontend/components/ui/LoadingState.tsx";
import StatCard from "@tokenring-ai/one-frontend/components/ui/StatCard.tsx";
import ViewShell from "@tokenring-ai/one-frontend/components/ui/ViewShell.tsx";
import { useCostSummary } from "@tokenring-ai/one-frontend/rpc.ts";
import { DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCount, formatUsd, shortCategoryLabel, topRecordEntries } from "../features/metrics/formatters.ts";

/** Headline spend, token and agent numbers for the main dashboard. */
export default function CostSummaryView() {
  const summary = useCostSummary();

  if (summary.isLoading && !summary.data) return <LoadingState size="sm" className="h-full" />;
  if (summary.error && !summary.data)
    return <ErrorState error={summary.error} onRetry={() => void summary.mutate()} title="Unable to load cost summary" variant="page" />;
  const data = summary.data;
  if (!data) return null;

  const inputTokens = data.tokens.totalInputTokens;
  const outputTokens = data.tokens.totalOutputTokens;
  const topAgents = [...data.agents].sort((a, b) => b.total - a.total).slice(0, 4);
  const topCategories = topRecordEntries(data.totalsByCategory, 3);

  return (
    <ViewShell pad="compact" bodyClassName="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Total spend" value={formatUsd(data.grandTotal)} />
        <StatCard label="Agents" value={`${data.activeAgentCount} active`} sub={`${data.agentCount} tracked`} />
        <StatCard label="Input tokens" value={formatCount(inputTokens)} />
        <StatCard label="Output tokens" value={formatCount(outputTokens)} />
      </div>
      {data.grandTotal === 0 && (
        <p className="text-xs text-muted" data-testid="cost-summary-zero-hint">
          No spend recorded yet. Costs appear here as agents chat, generate media or call billable tools.
        </p>
      )}
      {topCategories.length > 0 && (
        <ul className="text-xs text-muted space-y-1" aria-label="Spend by category">
          {topCategories.map(entry => (
            <li key={entry.key} className="flex items-center justify-between gap-2">
              <span className="truncate" title={entry.key}>
                {shortCategoryLabel(entry.key)}
              </span>
              <span className="tabular-nums text-secondary">{formatUsd(entry.value)}</span>
            </li>
          ))}
        </ul>
      )}
      {topAgents.length > 0 && (
        <ul className="divide-y divide-primary/60 border-t border-primary pt-1" aria-label="Top agents by spend">
          {topAgents.map(agent => (
            <li key={agent.agentId} className="flex items-center justify-between gap-2 py-1 text-xs">
              <span className="min-w-0 truncate text-primary">{agent.displayName}</span>
              <span className="shrink-0 tabular-nums text-muted">{formatUsd(agent.total)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link to="/metrics" className="inline-flex items-center gap-1 text-xs text-accent hover:underline focus-ring rounded">
        <DollarSign className="w-3 h-3" aria-hidden="true" /> Open Metrics
      </Link>
    </ViewShell>
  );
}
