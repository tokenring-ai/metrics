import type { MaybePromise } from "bun";
import { z } from "zod";

/** Token usage totals (BRAINSTORM §1.1). */
export const TokenUsageTotalsSchema = z
  .object({
    totalInputTokens: z.number().default(0),
    totalOutputTokens: z.number().default(0),
    totalCachedTokens: z.number().default(0),
    totalReasoningTokens: z.number().default(0),
  })
  .prefault({});

export type TokenUsageTotals = z.output<typeof TokenUsageTotalsSchema>;

/** Per-category token breakdown mirroring cost categories. */
export const TokenUsageByCategorySchema = z.record(z.string(), TokenUsageTotalsSchema);

export type TokenUsageByCategory = z.output<typeof TokenUsageByCategorySchema>;

/**
 * Input shape accepted by MetricsService.addUsage.
 * Compatible with LanguageModelUsage from @tokenring-ai/ai-client.
 */
export const TokenUsageInputSchema = z.object({
  inputTokens: z.number().default(0),
  outputTokens: z.number().default(0),
  inputTokenDetails: z
    .object({
      cacheReadTokens: z.number().default(0),
    })
    .partial()
    .optional(),
  outputTokenDetails: z
    .object({
      reasoningTokens: z.number().default(0),
    })
    .partial()
    .optional(),
  /** Convenience aliases when callers pass pre-flattened values. */
  cachedTokens: z.number().optional(),
  reasoningTokens: z.number().optional(),
});

export type TokenUsageInput = z.input<typeof TokenUsageInputSchema>;

/** Latency aggregates and sample window (BRAINSTORM §1.2). */
export const LatencyMetricsSchema = z
  .object({
    requestCount: z.number().default(0),
    totalElapsedMs: z.number().default(0),
    totalTimeToFirstTokenMs: z.number().default(0),
    timeToFirstTokenCount: z.number().default(0),
    totalTokensPerSecond: z.number().default(0),
    tokensPerSecondCount: z.number().default(0),
    /** Bounded recent elapsed-ms samples for approximate percentiles. */
    recentElapsedMs: z.array(z.number()).default([]),
    recentTimeToFirstTokenMs: z.array(z.number()).default([]),
  })
  .prefault({});

export type LatencyMetrics = z.output<typeof LatencyMetricsSchema>;

/** Input for a single latency observation. */
export const LatencySampleInputSchema = z.object({
  elapsedMs: z.number(),
  timeToFirstTokenMs: z.number().optional(),
  tokensPerSecond: z.number().optional(),
});

export type LatencySampleInput = z.input<typeof LatencySampleInputSchema>;

/** Error and retry counters (BRAINSTORM §1.3). */
export const ErrorMetricsSchema = z
  .object({
    errorsByProvider: z.record(z.string(), z.number()).default({}),
    errorsByType: z.record(z.string(), z.number()).default({}),
    retryCount: z.number().default(0),
  })
  .prefault({});

export type ErrorMetrics = z.output<typeof ErrorMetricsSchema>;

export const ErrorRecordInputSchema = z.object({
  provider: z.string().optional(),
  type: z.string().optional(),
  retries: z.number().optional(),
});

export type ErrorRecordInput = z.input<typeof ErrorRecordInputSchema>;

/** Step and tool-call counters (BRAINSTORM §1.4). */
export const ActivityMetricsSchema = z
  .object({
    totalSteps: z.number().default(0),
    totalToolCalls: z.number().default(0),
    toolCallsByName: z.record(z.string(), z.number()).default({}),
  })
  .prefault({});

export type ActivityMetrics = z.output<typeof ActivityMetricsSchema>;

/** Full per-agent metrics payload stored and tracked in-memory. */
export const AgentMetricsDataSchema = z
  .object({
    costs: z.record(z.string(), z.number()).default({}),
    tokens: TokenUsageTotalsSchema,
    tokensByCategory: TokenUsageByCategorySchema.default({}),
    latency: LatencyMetricsSchema,
    errors: ErrorMetricsSchema,
    activity: ActivityMetricsSchema,
  })
  .prefault({});

export type AgentMetricsData = z.output<typeof AgentMetricsDataSchema>;

/** Metrics document keyed by agent id for the storage backend. */
export const AgentMetricsSchema = z.object({
  agentId: z.string(),
  metrics: AgentMetricsDataSchema,
  updatedAt: z.number(),
});

export type AgentMetrics = z.input<typeof AgentMetricsSchema>;

export const StoredAgentMetricsSchema = AgentMetricsSchema;

export type StoredAgentMetrics = z.output<typeof StoredAgentMetricsSchema>;

export const AgentMetricsListItemSchema = z.object({
  agentId: z.string(),
  totalCost: z.number(),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  requestCount: z.number(),
  totalSteps: z.number(),
  totalToolCalls: z.number(),
  updatedAt: z.number(),
});

export type AgentMetricsListItem = z.output<typeof AgentMetricsListItemSchema>;

/**
 * Storage backend for per-agent metrics aggregates.
 * Implemented by `@tokenring-ai/bun-storage` (and potentially others).
 */
export interface MetricsStorage {
  displayName: string;

  /** Upsert aggregated metrics for an agent. */
  storeAgentMetrics(data: AgentMetrics): MaybePromise<void>;

  /** Load aggregated metrics for a single agent, or null if none. */
  retrieveAgentMetrics(agentId: string): MaybePromise<StoredAgentMetrics | null>;

  /** List summary rows for all agents that have stored metrics. */
  listAgentMetrics(): MaybePromise<AgentMetricsListItem[]>;

  /** Remove stored metrics for an agent. */
  deleteAgentMetrics(agentId: string): MaybePromise<void>;
}

/** Max recent latency samples retained for percentile approximation. */
export const LATENCY_SAMPLE_WINDOW = 100;

export function emptyAgentMetricsData(): AgentMetricsData {
  return AgentMetricsDataSchema.parse({});
}

export function normalizeTokenUsageInput(usage: TokenUsageInput): TokenUsageTotals {
  const parsed = TokenUsageInputSchema.parse(usage);
  return {
    totalInputTokens: parsed.inputTokens,
    totalOutputTokens: parsed.outputTokens,
    totalCachedTokens: parsed.cachedTokens ?? parsed.inputTokenDetails?.cacheReadTokens ?? 0,
    totalReasoningTokens: parsed.reasoningTokens ?? parsed.outputTokenDetails?.reasoningTokens ?? 0,
  };
}

export function addTokenTotals(a: TokenUsageTotals, b: TokenUsageTotals): TokenUsageTotals {
  return {
    totalInputTokens: a.totalInputTokens + b.totalInputTokens,
    totalOutputTokens: a.totalOutputTokens + b.totalOutputTokens,
    totalCachedTokens: a.totalCachedTokens + b.totalCachedTokens,
    totalReasoningTokens: a.totalReasoningTokens + b.totalReasoningTokens,
  };
}

export function pushBoundedSample(samples: number[], value: number, max = LATENCY_SAMPLE_WINDOW): number[] {
  const next = samples.length >= max ? samples.slice(samples.length - max + 1) : samples.slice();
  next.push(value);
  return next;
}

export function percentile(sortedSamples: number[], p: number): number | undefined {
  if (sortedSamples.length === 0) return undefined;
  if (sortedSamples.length === 1) return sortedSamples[0];
  const index = (p / 100) * (sortedSamples.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedSamples[lower];
  const weight = index - lower;
  return sortedSamples[lower]! * (1 - weight) + sortedSamples[upper]! * weight;
}

export function latencySummary(latency: LatencyMetrics) {
  const sortedElapsed = [...latency.recentElapsedMs].sort((a, b) => a - b);
  const sortedTtft = [...latency.recentTimeToFirstTokenMs].sort((a, b) => a - b);
  return {
    requestCount: latency.requestCount,
    avgElapsedMs: latency.requestCount > 0 ? latency.totalElapsedMs / latency.requestCount : 0,
    avgTimeToFirstTokenMs: latency.timeToFirstTokenCount > 0 ? latency.totalTimeToFirstTokenMs / latency.timeToFirstTokenCount : 0,
    avgTokensPerSecond: latency.tokensPerSecondCount > 0 ? latency.totalTokensPerSecond / latency.tokensPerSecondCount : 0,
    p50ElapsedMs: percentile(sortedElapsed, 50),
    p95ElapsedMs: percentile(sortedElapsed, 95),
    p99ElapsedMs: percentile(sortedElapsed, 99),
    p50TimeToFirstTokenMs: percentile(sortedTtft, 50),
    p95TimeToFirstTokenMs: percentile(sortedTtft, 95),
    p99TimeToFirstTokenMs: percentile(sortedTtft, 99),
  };
}

export function totalCostFromMetrics(metrics: AgentMetricsData): number {
  return Object.values(metrics.costs).reduce((sum, value) => sum + value, 0);
}

export function toAgentMetricsListItem(agentId: string, metrics: AgentMetricsData, updatedAt: number): AgentMetricsListItem {
  return AgentMetricsListItemSchema.parse({
    agentId,
    totalCost: totalCostFromMetrics(metrics),
    totalInputTokens: metrics.tokens.totalInputTokens,
    totalOutputTokens: metrics.tokens.totalOutputTokens,
    requestCount: metrics.latency.requestCount,
    totalSteps: metrics.activity.totalSteps,
    totalToolCalls: metrics.activity.totalToolCalls,
    updatedAt,
  });
}
