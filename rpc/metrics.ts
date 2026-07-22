import { AgentManager } from "@tokenring-ai/agent";
import type Agent from "@tokenring-ai/agent/Agent";
import type TokenRingApp from "@tokenring-ai/app";
import { createPollingQueryStream } from "@tokenring-ai/rpc/createPollingQueryStream";
import { createRPCEndpoint } from "@tokenring-ai/rpc/createRPCEndpoint";
import { aggregateCostSummary, readAgentCosts } from "../costSummary.ts";
import MetricsService from "../MetricsService.ts";
import { CostTrackingState } from "../state/costTrackingState.ts";
import type { CostSummary } from "./schema.ts";
import MetricsRpcSchema from "./schema.ts";

function projectCostSummary(app: TokenRingApp): CostSummary {
  // Ensure MetricsService is installed; throws if missing so the client sees a clear error.
  app.requireService(MetricsService);

  const agents = app
    .requireService(AgentManager)
    .getAgents()
    .map((agent: Agent) => readAgentCosts(agent));
  return aggregateCostSummary(agents);
}

const streamCostSummary = createPollingQueryStream({
  intervalMs: 2000,
  poll: (_args, app) => projectCostSummary(app),
});

export default createRPCEndpoint(MetricsRpcSchema, {
  getCostSummary(_args, app: TokenRingApp) {
    return projectCostSummary(app);
  },

  streamCostSummary,

  getAgentCosts(args, app: TokenRingApp) {
    app.requireService(MetricsService);
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" as const };
    }
    return {
      status: "success" as const,
      agent: readAgentCosts(agent),
    };
  },

  resetAgentCosts(args, app: TokenRingApp) {
    app.requireService(MetricsService);
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" as const };
    }

    try {
      agent.mutateState(CostTrackingState, state => {
        state.reset();
      });
    } catch {
      // Agent may not have metrics state attached yet — treat as success (already empty).
    }

    return { status: "success" as const };
  },
});
