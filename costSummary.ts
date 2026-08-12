import type Agent from "@tokenring-ai/agent/Agent";
import { AgentEventState } from "@tokenring-ai/agent/state/agentEventState";
import { latencySummary } from "./MetricsStorage.ts";
import type { ActivityMetricsSummary, AgentCosts, CostSummary, ErrorMetricsSummary, LatencySummary, TokenUsageTotals } from "./rpc/schema.ts";
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

export function readAgentCosts(agent: Agent): AgentCosts {
  let costs: Record<string, number> = {};
  let tokens = emptyTokens();
  let latency = emptyLatency();
  let errors = emptyErrors();
  let activity = emptyActivity();

  try {
    const state = agent.getState(CostTrackingState);
    costs = { ...state.costs };
    tokens = { ...state.tokens };
    const summary = latencySummary(state.latency);
    latency = {
      requestCount: summary.requestCount,
      avgElapsedMs: summary.avgElapsedMs,
      avgTimeToFirstTokenMs: summary.avgTimeToFirstTokenMs,
      avgTokensPerSecond: summary.avgTokensPerSecond,
      ...(summary.p50ElapsedMs !== undefined && { p50ElapsedMs: summary.p50ElapsedMs }),
      ...(summary.p95ElapsedMs !== undefined && { p95ElapsedMs: summary.p95ElapsedMs }),
      ...(summary.p99ElapsedMs !== undefined && { p99ElapsedMs: summary.p99ElapsedMs }),
    };
    errors = {
      errorsByProvider: { ...state.errors.errorsByProvider },
      errorsByType: { ...state.errors.errorsByType },
      retryCount: state.errors.retryCount,
    };
    activity = {
      totalSteps: state.activity.totalSteps,
      totalToolCalls: state.activity.totalToolCalls,
      toolCallsByName: { ...state.activity.toolCallsByName },
    };
  } catch {
    // Agent may not have metrics state yet.
  }

  const total = Object.values(costs).reduce((sum, value) => sum + value, 0);
  let idle: boolean;
  try {
    idle = agent.getState(AgentEventState).idle;
  } catch {
    idle = true;
  }

  return {
    agentId: agent.id,
    displayName: agent.displayName,
    agentType: agent.config.agentType,
    idle,
    costs,
    total,
    tokens,
    latency,
    errors,
    activity,
  };
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

  return {
    requestCount,
    avgElapsedMs: requestCount > 0 ? weightedElapsed / requestCount : 0,
    avgTimeToFirstTokenMs: ttftWeight > 0 ? weightedTtft / ttftWeight : 0,
    avgTokensPerSecond: tpsWeight > 0 ? weightedTps / tpsWeight : 0,
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
    latency: aggregateLatency(agentCosts),
    errors: aggregateErrors(agentCosts),
    activity: aggregateActivity(agentCosts),
  };
}
