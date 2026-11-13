import { usePanelTitle } from "@tokenring-ai/one-frontend/apps/panelHooks.ts";
import ErrorState from "@tokenring-ai/one-frontend/components/ui/ErrorState.tsx";
import LoadingState from "@tokenring-ai/one-frontend/components/ui/LoadingState.tsx";
import type { ViewProps } from "@tokenring-ai/one-frontend/layout/define.ts";
import { usePaneLink } from "@tokenring-ai/one-frontend/layout/hooks.ts";
import { Badge, Button, EmptyState, ViewHeader, ViewShell } from "@tokenring-ai/one-frontend/ui";
import { MessageSquare, ReceiptText, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import AgentBreakdown from "../features/metrics/AgentBreakdown.tsx";
import { formatAgentIdShort, formatRelativeTime, formatUsd } from "../features/metrics/formatters.ts";
import { METRICS_GRADIENT } from "../ids.ts";
import { useAgentMetricsHistory } from "../lib/metricsQueries.ts";

/**
 * Full metrics breakdown for one agent, running or stored. Opened from the
 * History view; one panel per agent.
 */
export default function MetricsAgentDetailPane({ params }: ViewProps) {
  const agentId = params["agentId"];
  const detail = useAgentMetricsHistory(agentId);
  const paneLink = usePaneLink();
  const result = detail.data;
  const agent = result?.status === "success" ? result.agent : undefined;

  usePanelTitle(agent ? `${agent.displayName} · metrics` : null);

  let body: ReactNode;
  if (!agentId) {
    body = <EmptyState icon={SearchX} title="No agent selected" hint="Pick an agent in the History view." />;
  } else if (detail.isLoading && !result) {
    body = <LoadingState message="Loading metrics…" size="md" />;
  } else if (detail.error && !result) {
    body = <ErrorState title="Unable to load agent metrics" error={detail.error} onRetry={() => void detail.mutate()} variant="page" />;
  } else if (!agent || result?.status !== "success") {
    body = (
      <EmptyState
        icon={SearchX}
        title="No metrics for this agent"
        hint="Its stored metrics may have been reset or removed by retention."
        data-testid="metrics-agent-detail-missing"
      />
    );
  } else {
    body = (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-primary truncate">{agent.displayName}</h2>
              {result.live ? <Badge tone="success">Running</Badge> : <Badge tone="neutral">Stored</Badge>}
            </div>
            <p className="text-xs text-muted truncate">
              {agent.agentType}
              <span className="mx-1.5 opacity-40">·</span>
              <span className="font-mono opacity-80">{formatAgentIdShort(agent.agentId)}</span>
              <span className="mx-1.5 opacity-40">·</span>
              <span title={new Date(result.updatedAt).toLocaleString()}>updated {result.live ? "now" : formatRelativeTime(result.updatedAt)}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-lg font-semibold tabular-nums text-primary">{formatUsd(agent.total)}</span>
            {result.live ? (
              <Button variant="secondary" icon={MessageSquare} onClick={() => paneLink("chat", { agentId: agent.agentId })}>
                Open chat
              </Button>
            ) : null}
          </div>
        </div>
        <AgentBreakdown agent={agent} />
      </div>
    );
  }

  return (
    <ViewShell
      pad="page"
      header={<ViewHeader title="Agent metrics" icon={ReceiptText} iconGradient={METRICS_GRADIENT} subtitle={agent?.displayName ?? agentId ?? ""} />}
      data-testid="metrics-agent-detail-view"
    >
      {body}
    </ViewShell>
  );
}
