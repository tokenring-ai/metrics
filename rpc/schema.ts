import type { RPCSchema } from "@tokenring-ai/rpc/types";
import { AgentNotFoundSchema, SuccessSchema } from "@tokenring-ai/rpc/types";
import { z } from "zod";

export const TokenUsageTotalsSchema = z
  .object({
    totalInputTokens: z.number().default(0),
    totalOutputTokens: z.number().default(0),
    totalCachedTokens: z.number().default(0),
    totalReasoningTokens: z.number().default(0),
  })
  .prefault({});

export const LatencySummarySchema = z
  .object({
    requestCount: z.number().default(0),
    avgElapsedMs: z.number().default(0),
    avgTimeToFirstTokenMs: z.number().default(0),
    avgTokensPerSecond: z.number().default(0),
    p50ElapsedMs: z.number().optional(),
    p95ElapsedMs: z.number().optional(),
    p99ElapsedMs: z.number().optional(),
    p50TimeToFirstTokenMs: z.number().optional(),
    p95TimeToFirstTokenMs: z.number().optional(),
    p99TimeToFirstTokenMs: z.number().optional(),
  })
  .prefault({});

/** Token totals per cost category (one entry per model, e.g. "Chat (OpenAI:gpt-4o)"). */
export const TokensByCategorySchema = z.record(z.string(), TokenUsageTotalsSchema);

export const ErrorMetricsSummarySchema = z
  .object({
    errorsByProvider: z.record(z.string(), z.number()).default({}),
    errorsByType: z.record(z.string(), z.number()).default({}),
    retryCount: z.number().default(0),
  })
  .prefault({});

export const ActivityMetricsSummarySchema = z
  .object({
    totalSteps: z.number().default(0),
    totalToolCalls: z.number().default(0),
    toolCallsByName: z.record(z.string(), z.number()).default({}),
  })
  .prefault({});

export const AgentCostsSchema = z.object({
  agentId: z.string(),
  displayName: z.string(),
  agentType: z.string(),
  idle: z.boolean(),
  costs: z.record(z.string(), z.number()),
  total: z.number(),
  tokens: TokenUsageTotalsSchema,
  tokensByCategory: TokensByCategorySchema.default({}),
  latency: LatencySummarySchema,
  errors: ErrorMetricsSummarySchema,
  activity: ActivityMetricsSummarySchema,
});

export const CostSummarySchema = z.object({
  agents: z.array(AgentCostsSchema),
  totalsByCategory: z.record(z.string(), z.number()),
  grandTotal: z.number(),
  agentCount: z.number(),
  activeAgentCount: z.number(),
  tokens: TokenUsageTotalsSchema,
  tokensByCategory: TokensByCategorySchema.default({}),
  latency: LatencySummarySchema,
  errors: ErrorMetricsSummarySchema,
  activity: ActivityMetricsSummarySchema,
});

export const SpendRangeSchema = z.enum(["1h", "24h", "7d", "30d"]);

export const SpendSeriesPointSchema = z.object({
  /** Bucket start, epoch ms. */
  t: z.number(),
  cost: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  requests: z.number(),
});

export const SpendSeriesSchema = z.object({
  range: SpendRangeSchema,
  bucketMs: z.number(),
  start: z.number(),
  end: z.number(),
  buckets: z.array(SpendSeriesPointSchema),
  totals: SpendSeriesPointSchema.omit({ t: true }),
});

/** One row of the cross-session History list: a live agent, a stored one, or both merged. */
export const AgentHistoryItemSchema = z.object({
  agentId: z.string(),
  displayName: z.string(),
  agentType: z.string(),
  /** True while the agent is running in this app (its row reflects live counters). */
  live: z.boolean(),
  totalCost: z.number(),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  requestCount: z.number(),
  totalSteps: z.number(),
  totalToolCalls: z.number(),
  /** Last time the metrics changed (epoch ms); live agents report now. */
  updatedAt: z.number(),
});

export const AgentHistoryListSchema = z.object({
  /** False when no MetricsStorage is registered: only live agents are listed. */
  persisted: z.boolean(),
  items: z.array(AgentHistoryItemSchema),
});

export type TokenUsageTotals = z.output<typeof TokenUsageTotalsSchema>;
export type LatencySummary = z.output<typeof LatencySummarySchema>;
export type ErrorMetricsSummary = z.output<typeof ErrorMetricsSummarySchema>;
export type ActivityMetricsSummary = z.output<typeof ActivityMetricsSummarySchema>;
export type AgentCosts = z.output<typeof AgentCostsSchema>;
export type CostSummary = z.output<typeof CostSummarySchema>;
export type TokensByCategory = z.output<typeof TokensByCategorySchema>;
export type SpendRange = z.output<typeof SpendRangeSchema>;
export type SpendSeries = z.output<typeof SpendSeriesSchema>;
export type SpendSeriesPoint = z.output<typeof SpendSeriesPointSchema>;
export type AgentHistoryItem = z.output<typeof AgentHistoryItemSchema>;
export type AgentHistoryList = z.output<typeof AgentHistoryListSchema>;

export default {
  name: "Metrics RPC",
  path: "/rpc/metrics",
  methods: {
    getCostSummary: {
      type: "query",
      input: z.object({}),
      result: CostSummarySchema,
    },
    streamCostSummary: {
      type: "stream",
      input: z.object({}),
      result: CostSummarySchema,
    },
    getAgentCosts: {
      type: "query",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          agent: AgentCostsSchema,
        }),
        AgentNotFoundSchema,
      ]),
    },
    resetAgentCosts: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [SuccessSchema, AgentNotFoundSchema]),
    },
    resetAllAgentCosts: {
      type: "mutation",
      input: z.object({}),
      result: SuccessSchema.extend({ resetCount: z.number() }),
    },
    getSpendSeries: {
      type: "query",
      input: z.object({ range: SpendRangeSchema }),
      result: SpendSeriesSchema,
    },
    listAgentMetricsHistory: {
      type: "query",
      input: z.object({}),
      result: AgentHistoryListSchema,
    },
    getAgentMetricsHistory: {
      type: "query",
      input: z.object({ agentId: z.string() }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          agent: AgentCostsSchema,
          live: z.boolean(),
          updatedAt: z.number(),
        }),
        AgentNotFoundSchema,
      ]),
    },
  },
} satisfies RPCSchema;
