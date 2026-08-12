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
  })
  .prefault({});

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
  latency: LatencySummarySchema,
  errors: ErrorMetricsSummarySchema,
  activity: ActivityMetricsSummarySchema,
});

export type TokenUsageTotals = z.output<typeof TokenUsageTotalsSchema>;
export type LatencySummary = z.output<typeof LatencySummarySchema>;
export type ErrorMetricsSummary = z.output<typeof ErrorMetricsSummarySchema>;
export type ActivityMetricsSummary = z.output<typeof ActivityMetricsSummarySchema>;
export type AgentCosts = z.output<typeof AgentCostsSchema>;
export type CostSummary = z.output<typeof CostSummarySchema>;

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
  },
} satisfies RPCSchema;
