import type Agent from "@tokenring-ai/agent/Agent";
import { AgentEventState } from "@tokenring-ai/agent/state/agentEventState";
import { type AgentMetricsData, latencySummary } from "./MetricsStorage.ts";
import type { ActivityMetricsSummary, AgentCosts, CostSummary, ErrorMetricsSummary, LatencySummary, TokensByCategory, TokenUsageTotals } from "./rpc/schema.ts";
import { ActivityMetricsSummarySchema, ErrorMetricsSummarySchema, LatencySummarySchema, TokenUsageTotalsSchema } from "./rpc/schema.ts";
import { CostTrackingState } from "./state/costTrackingState.ts";

const emptyTokens = (): TokenUsageTotals => TokenUsageTotalsSchema.parse({});
const emptyLatency = (): LatencySummary => LatencySummarySchema.parse({});
const emptyErrors = (): ErrorMetricsSummary => ErrorMetricsSummarySchema.parse({});
const emptyActivity = (): ActivityMetricsSummary => ActivityMetricsSummarySchema.parse({});

function addRecordCounts(target: Record<string, number>, source: Record<string, number>): void {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

/** The metric fields both CostTrackingState and stored AgentMetricsData carry. */
type MetricsSource = Pick<AgentMetricsData, "costs" | "tokens" | "tokensByCategory" | "latency" | "errors" | "activity">;

/** Project raw metrics (live state or a stored record) into the RPC per-agent shape. */
export function agentCostsFromMetrics(
  source: MetricsSource | null,
  meta: { agentId: string; displayName: string; agentType: string; idle: boolean },
): AgentCosts {
  let costs: Record<string, number> = {};
  let tokens = emptyTokens();
  let tokensByCategory: TokensByCategory = {};
  let latency = emptyLatency();
  let errors = emptyErrors();
  let activity = emptyActivity();

  if (source) {
    costs = { ...source.costs };
    tokens = { ...source.tokens };
    tokensByCategory = Object.fromEntries(Object.entries(source.tokensByCategory).map(([key, value]) => [key, { ...value }]));
    const summary = latencySummary(source.latency);
    latency = {
      requestCount: summary.requestCount,
      avgElapsedMs: summary.avgElapsedMs,
      avgTimeToFirstTokenMs: summary.avgTimeToFirstTokenMs,
      avgTokensPerSecond: summary.avgTokensPerSecond,
      ...(summary.p50ElapsedMs !== undefined && { p50ElapsedMs: summary.p50ElapsedMs }),
      ...(summary.p95ElapsedMs !== undefined && { p95ElapsedMs: summary.p95ElapsedMs }),
      ...(summary.p99ElapsedMs !== undefined && { p99ElapsedMs: summary.p99ElapsedMs }),
      ...(summary.p50TimeToFirstTokenMs !== undefined && { p50TimeToFirstTokenMs: summary.p50TimeToFirstTokenMs }),
      ...(summary.p95TimeToFirstTokenMs !== undefined && { p95TimeToFirstTokenMs: summary.p95TimeToFirstTokenMs }),
      ...(summary.p99TimeToFirstTokenMs !== undefined && { p99TimeToFirstTokenMs: summary.p99TimeToFirstTokenMs }),
    };
    errors = {
      errorsByProvider: { ...source.errors.errorsByProvider },
      errorsByType: { ...source.errors.errorsByType },
      retryCount: source.errors.retryCount,
    };
    activity = {
      totalSteps: source.activity.totalSteps,
      totalToolCalls: source.activity.totalToolCalls,
      toolCallsByName: { ...source.activity.toolCallsByName },
    };
  }

  const total = Object.values(costs).reduce((sum, value) => sum + value, 0);

  return {
    ...meta,
    costs,
    total,
    tokens,
    tokensByCategory,
    latency,
    errors,
    activity,
  };
}

export function readAgentCosts(agent: Agent): AgentCosts {
  let state: CostTrackingState | null = null;
  try {
    state = agent.getState(CostTrackingState);
  } catch {
    // Agent may not have metrics state yet.
  }

  let idle: boolean;
  try {
    idle = agent.getState(AgentEventState).idle;
  } catch {
    idle = true;
  }

  return agentCostsFromMetrics(state, {
    agentId: agent.id,
    displayName: agent.displayName,
    agentType: agent.config.agentType,
    idle,
  });
}

function aggregateTokens(agents: AgentCosts[]): TokenUsageTotals {
  const tokens = emptyTokens();
  for (const agent of agents) {
    tokens.totalInputTokens += agent.tokens.totalInputTokens;
    tokens.totalOutputTokens += agent.tokens.totalOutputTokens;
    tokens.totalCachedTokens += agent.tokens.totalCachedTokens;
    tokens.totalReasoningTokens += agent.tokens.totalReasoningTokens;
  }
  return tokens;
}

function aggregateTokensByCategory(agents: AgentCosts[]): TokensByCategory {
  const result: TokensByCategory = {};
  for (const agent of agents) {
    for (const [category, usage] of Object.entries(agent.tokensByCategory)) {
      const target = (result[category] ??= emptyTokens());
      target.totalInputTokens += usage.totalInputTokens;
      target.totalOutputTokens += usage.totalOutputTokens;
      target.totalCachedTokens += usage.totalCachedTokens;
      target.totalReasoningTokens += usage.totalReasoningTokens;
    }
  }
  return result;
}

type PercentileField = "p50ElapsedMs" | "p95ElapsedMs" | "p99ElapsedMs" | "p50TimeToFirstTokenMs" | "p95TimeToFirstTokenMs" | "p99TimeToFirstTokenMs";

/**
 * Request-weighted mean of per-agent percentiles. An approximation (the true
 * fleet percentile needs the raw samples), but stable and cheap.
 */
function weightedLatencyPercentile(agents: AgentCosts[], field: PercentileField): number | undefined {
  let weighted = 0;
  let weight = 0;
  for (const agent of agents) {
    const n = agent.latency.requestCount;
    const value = agent.latency[field];
    if (n <= 0 || value === undefined) continue;
    weighted += value * n;
    weight += n;
  }
  return weight > 0 ? weighted / weight : undefined;
}

function aggregateLatency(agents: AgentCosts[]): LatencySummary {
  let requestCount = 0;
  let weightedElapsed = 0;
  let weightedTtft = 0;
  let ttftWeight = 0;
  let weightedTps = 0;
  let tpsWeight = 0;

  for (const agent of agents) {
    const n = agent.latency.requestCount;
    if (n <= 0) continue;
    requestCount += n;
    weightedElapsed += agent.latency.avgElapsedMs * n;
    if (agent.latency.avgTimeToFirstTokenMs > 0) {
      weightedTtft += agent.latency.avgTimeToFirstTokenMs * n;
      ttftWeight += n;
    }
    if (agent.latency.avgTokensPerSecond > 0) {
      weightedTps += agent.latency.avgTokensPerSecond * n;
      tpsWeight += n;
    }
  }

  const p50ElapsedMs = weightedLatencyPercentile(agents, "p50ElapsedMs");
  const p95ElapsedMs = weightedLatencyPercentile(agents, "p95ElapsedMs");
  const p99ElapsedMs = weightedLatencyPercentile(agents, "p99ElapsedMs");
  const p50TimeToFirstTokenMs = weightedLatencyPercentile(agents, "p50TimeToFirstTokenMs");
  const p95TimeToFirstTokenMs = weightedLatencyPercentile(agents, "p95TimeToFirstTokenMs");
  const p99TimeToFirstTokenMs = weightedLatencyPercentile(agents, "p99TimeToFirstTokenMs");

  return {
    requestCount,
    avgElapsedMs: requestCount > 0 ? weightedElapsed / requestCount : 0,
    avgTimeToFirstTokenMs: ttftWeight > 0 ? weightedTtft / ttftWeight : 0,
    avgTokensPerSecond: tpsWeight > 0 ? weightedTps / tpsWeight : 0,
    ...(p50ElapsedMs !== undefined && { p50ElapsedMs }),
    ...(p95ElapsedMs !== undefined && { p95ElapsedMs }),
    ...(p99ElapsedMs !== undefined && { p99ElapsedMs }),
    ...(p50TimeToFirstTokenMs !== undefined && { p50TimeToFirstTokenMs }),
    ...(p95TimeToFirstTokenMs !== undefined && { p95TimeToFirstTokenMs }),
    ...(p99TimeToFirstTokenMs !== undefined && { p99TimeToFirstTokenMs }),
  };
}

function aggregateErrors(agents: AgentCosts[]): ErrorMetricsSummary {
  const errors = emptyErrors();
  for (const agent of agents) {
    addRecordCounts(errors.errorsByProvider, agent.errors.errorsByProvider);
    addRecordCounts(errors.errorsByType, agent.errors.errorsByType);
    errors.retryCount += agent.errors.retryCount;
  }
  return errors;
}

function aggregateActivity(agents: AgentCosts[]): ActivityMetricsSummary {
  const activity = emptyActivity();
  for (const agent of agents) {
    activity.totalSteps += agent.activity.totalSteps;
    activity.totalToolCalls += agent.activity.totalToolCalls;
    addRecordCounts(activity.toolCallsByName, agent.activity.toolCallsByName);
  }
  return activity;
}

export function aggregateCostSummary(agentCosts: AgentCosts[]): CostSummary {
  const totalsByCategory: Record<string, number> = {};

  for (const agent of agentCosts) {
    for (const [category, amount] of Object.entries(agent.costs)) {
      totalsByCategory[category] = (totalsByCategory[category] ?? 0) + amount;
    }
  }

  const grandTotal = Object.values(totalsByCategory).reduce((sum, value) => sum + value, 0);

  return {
    agents: [...agentCosts].sort((a, b) => b.total - a.total),
    totalsByCategory,
    grandTotal,
    agentCount: agentCosts.length,
    activeAgentCount: agentCosts.filter(agent => !agent.idle).length,
    tokens: aggregateTokens(agentCosts),
    tokensByCategory: aggregateTokensByCategory(agentCosts),
    latency: aggregateLatency(agentCosts),
    errors: aggregateErrors(agentCosts),
    activity: aggregateActivity(agentCosts),
  };
}
