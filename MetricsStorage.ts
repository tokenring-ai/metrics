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

/** One time bucket of spend: cost, tokens and request count recorded inside it. */
export const SpendPointSchema = z.object({
  /** Bucket start, epoch ms (aligned to the bucket size). */
  t: z.number(),
  cost: z.number().default(0),
  inputTokens: z.number().default(0),
  outputTokens: z.number().default(0),
  requests: z.number().default(0),
});

export type SpendPoint = z.output<typeof SpendPointSchema>;

/**
 * Bounded spend time series kept per agent. `fine` holds 5-minute buckets for
 * the last day (the 1h range), `hourly` holds hour buckets for the last 30
 * days (every other range). Both are sorted by `t` ascending.
 */
export const SpendHistorySchema = z
  .object({
    fine: z.array(SpendPointSchema).default([]),
    hourly: z.array(SpendPointSchema).default([]),
  })
  .prefault({});

export type SpendHistory = z.output<typeof SpendHistorySchema>;

/** Who an agent was, stamped onto persisted metrics so history outlives the agent. */
export const AgentIdentitySchema = z.object({
  displayName: z.string(),
  agentType: z.string(),
});

export type AgentIdentity = z.output<typeof AgentIdentitySchema>;

/** Full per-agent metrics payload stored and tracked in-memory. */
export const AgentMetricsDataSchema = z
  .object({
    costs: z.record(z.string(), z.number()).default({}),
    tokens: TokenUsageTotalsSchema,
    tokensByCategory: TokenUsageByCategorySchema.default({}),
    latency: LatencyMetricsSchema,
    errors: ErrorMetricsSchema,
    activity: ActivityMetricsSchema,
    spendHistory: SpendHistorySchema,
    /** Set when persisted; absent on in-memory state. */
    identity: AgentIdentitySchema.optional(),
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

export type StoredAgentMetrics = z.output<typeof AgentMetricsSchema>;

export const AgentMetricsListItemSchema = z.object({
  agentId: z.string(),
  totalCost: z.number(),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  requestCount: z.number(),
  totalSteps: z.number(),
  totalToolCalls: z.number(),
  updatedAt: z.number(),
  displayName: z.string().optional(),
  agentType: z.string().optional(),
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

  /**
   * Full stored metrics for every agent (used for cross-session spend series).
   * Optional: backends without it only contribute live agents to the series.
   */
  listAllAgentMetrics?(): MaybePromise<StoredAgentMetrics[]>;
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
    ...(metrics.identity && { displayName: metrics.identity.displayName, agentType: metrics.identity.agentType }),
    totalCost: totalCostFromMetrics(metrics),
    totalInputTokens: metrics.tokens.totalInputTokens,
    totalOutputTokens: metrics.tokens.totalOutputTokens,
    requestCount: metrics.latency.requestCount,
    totalSteps: metrics.activity.totalSteps,
    totalToolCalls: metrics.activity.totalToolCalls,
    updatedAt,
  });
}

// ── Spend time series ───────────────────────────────────────────────────────

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const SPEND_FINE_BUCKET_MS = 5 * MINUTE_MS;
export const SPEND_FINE_RETENTION_MS = DAY_MS;
export const SPEND_HOURLY_BUCKET_MS = HOUR_MS;
export const SPEND_HOURLY_RETENTION_MS = 31 * DAY_MS;

export type SpendDelta = { cost?: number; inputTokens?: number; outputTokens?: number; requests?: number };

function addToSeries(series: SpendPoint[], bucketMs: number, retentionMs: number, now: number, delta: SpendDelta): SpendPoint[] {
  const t = Math.floor(now / bucketMs) * bucketMs;
  // Walk back from the end: samples almost always land in the newest bucket.
  let index = series.length - 1;
  while (index >= 0 && series[index]!.t > t) index--;
  let point = index >= 0 && series[index]!.t === t ? series[index]! : undefined;
  if (!point) {
    point = { t, cost: 0, inputTokens: 0, outputTokens: 0, requests: 0 };
    series.splice(index + 1, 0, point);
  }
  point.cost += delta.cost ?? 0;
  point.inputTokens += delta.inputTokens ?? 0;
  point.outputTokens += delta.outputTokens ?? 0;
  point.requests += delta.requests ?? 0;

  const cutoff = now - retentionMs;
  let drop = 0;
  while (drop < series.length && series[drop]!.t + bucketMs <= cutoff) drop++;
  if (drop > 0) series.splice(0, drop);
  return series;
}

/** Add a sample to both resolutions of a spend history (mutates and returns it). */
export function recordSpendSample(history: SpendHistory, delta: SpendDelta, now = Date.now()): SpendHistory {
  addToSeries(history.fine, SPEND_FINE_BUCKET_MS, SPEND_FINE_RETENTION_MS, now, delta);
  addToSeries(history.hourly, SPEND_HOURLY_BUCKET_MS, SPEND_HOURLY_RETENTION_MS, now, delta);
  return history;
}

export const SPEND_RANGES = ["1h", "24h", "7d", "30d"] as const;
export type SpendRange = (typeof SPEND_RANGES)[number];

/** Window length, bucket size and source resolution for each selectable range. */
export const SPEND_RANGE_CONFIG: Record<SpendRange, { windowMs: number; bucketMs: number; source: keyof SpendHistory }> = {
  "1h": { windowMs: HOUR_MS, bucketMs: SPEND_FINE_BUCKET_MS, source: "fine" },
  "24h": { windowMs: DAY_MS, bucketMs: HOUR_MS, source: "hourly" },
  "7d": { windowMs: 7 * DAY_MS, bucketMs: 6 * HOUR_MS, source: "hourly" },
  "30d": { windowMs: 30 * DAY_MS, bucketMs: DAY_MS, source: "hourly" },
};

export type SpendSeries = {
  range: SpendRange;
  bucketMs: number;
  start: number;
  end: number;
  buckets: SpendPoint[];
  totals: Omit<SpendPoint, "t">;
};

/**
 * Sum several agents' spend histories into fixed buckets covering `range`
 * ending at `now`. Buckets are epoch-aligned (UTC), the last one contains
 * `now`, and empty buckets are included so the chart has a stable x axis.
 */
export function bucketSpendSeries(histories: Iterable<SpendHistory>, range: SpendRange, now = Date.now()): SpendSeries {
  const { windowMs, bucketMs, source } = SPEND_RANGE_CONFIG[range];
  const count = Math.round(windowMs / bucketMs);
  const end = (Math.floor(now / bucketMs) + 1) * bucketMs;
  const start = end - count * bucketMs;
  const buckets: SpendPoint[] = Array.from({ length: count }, (_, i) => ({
    t: start + i * bucketMs,
    cost: 0,
    inputTokens: 0,
    outputTokens: 0,
    requests: 0,
  }));
  const totals = { cost: 0, inputTokens: 0, outputTokens: 0, requests: 0 };
  for (const history of histories) {
    for (const point of history[source]) {
      if (point.t < start || point.t >= end) continue;
      const bucket = buckets[Math.floor((point.t - start) / bucketMs)]!;
      bucket.cost += point.cost;
      bucket.inputTokens += point.inputTokens;
      bucket.outputTokens += point.outputTokens;
      bucket.requests += point.requests;
      totals.cost += point.cost;
      totals.inputTokens += point.inputTokens;
      totals.outputTokens += point.outputTokens;
      totals.requests += point.requests;
    }
  }
  return { range, bucketMs, start, end, buckets, totals };
}
