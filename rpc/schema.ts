import type { RPCSchema } from "@tokenring-ai/rpc/types";
import { AgentNotFoundSchema, SuccessSchema } from "@tokenring-ai/rpc/types";
import { z } from "zod";

export const AgentCostsSchema = z.object({
  agentId: z.string(),
  displayName: z.string(),
  agentType: z.string(),
  idle: z.boolean(),
  costs: z.record(z.string(), z.number()),
  total: z.number(),
});

export const CostSummarySchema = z.object({
  agents: z.array(AgentCostsSchema),
  totalsByCategory: z.record(z.string(), z.number()),
  grandTotal: z.number(),
  agentCount: z.number(),
  activeAgentCount: z.number(),
});

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
