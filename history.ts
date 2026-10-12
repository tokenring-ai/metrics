import type { AgentMetricsListItem, SpendHistory, StoredAgentMetrics } from "./MetricsStorage.ts";
import type { AgentCosts, AgentHistoryItem } from "./rpc/schema.ts";

/**
 * Merge live agents with stored (cross-session) metrics into History rows.
 * A live agent wins over its stored record, since the store lags the live
 * counters by one persist. Rows are ordered newest first.
 */
export function buildHistoryList(live: AgentCosts[], stored: AgentMetricsListItem[], now = Date.now()): AgentHistoryItem[] {
  const rows = new Map<string, AgentHistoryItem>();
  for (const item of stored) {
    rows.set(item.agentId, {
      agentId: item.agentId,
      displayName: item.displayName ?? item.agentId,
      agentType: item.agentType ?? "unknown",
      live: false,
      totalCost: item.totalCost,
      totalInputTokens: item.totalInputTokens,
      totalOutputTokens: item.totalOutputTokens,
      requestCount: item.requestCount,
      totalSteps: item.totalSteps,
      totalToolCalls: item.totalToolCalls,
      updatedAt: item.updatedAt,
    });
  }
  for (const agent of live) {
    rows.set(agent.agentId, {
      agentId: agent.agentId,
      displayName: agent.displayName,
      agentType: agent.agentType,
      live: true,
      totalCost: agent.total,
      totalInputTokens: agent.tokens.totalInputTokens,
      totalOutputTokens: agent.tokens.totalOutputTokens,
      requestCount: agent.latency.requestCount,
      totalSteps: agent.activity.totalSteps,
      totalToolCalls: agent.activity.totalToolCalls,
      updatedAt: now,
    });
  }
  return [...rows.values()].sort((a, b) => b.updatedAt - a.updatedAt || a.displayName.localeCompare(b.displayName));
}

/** Spend histories to chart: every live agent plus stored agents that are no longer running. */
export function collectSpendHistories(live: Map<string, SpendHistory>, stored: StoredAgentMetrics[]): SpendHistory[] {
  const histories = [...live.values()];
  for (const record of stored) {
    if (!live.has(record.agentId)) histories.push(record.metrics.spendHistory);
  }
  return histories;
}
