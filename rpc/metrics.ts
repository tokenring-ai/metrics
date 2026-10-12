import { AgentManager } from "@tokenring-ai/agent";
import type Agent from "@tokenring-ai/agent/Agent";
import type TokenRingApp from "@tokenring-ai/app";
import { createPollingQueryStream } from "@tokenring-ai/rpc/createPollingQueryStream";
import { createRPCEndpoint } from "@tokenring-ai/rpc/createRPCEndpoint";
import { agentCostsFromMetrics, aggregateCostSummary, readAgentCosts } from "../costSummary.ts";
import { buildHistoryList, collectSpendHistories } from "../history.ts";
import MetricsService from "../MetricsService.ts";
import { bucketSpendSeries, type SpendHistory, type StoredAgentMetrics } from "../MetricsStorage.ts";
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
      app.requireService(MetricsService).resetAgentMetrics(agent);
    } catch {
      // Agent may not have metrics state attached yet — treat as success (already empty).
      try {
        agent.mutateState(CostTrackingState, state => {
          state.reset();
        });
      } catch {
        // already empty
      }
    }

    return { status: "success" as const };
  },

  resetAllAgentCosts(_args, app: TokenRingApp) {
    const resetCount = app.requireService(MetricsService).resetAllAgentMetrics(app.requireService(AgentManager).getAgents());
    return { status: "success" as const, resetCount };
  },

  async getSpendSeries(args, app: TokenRingApp) {
    const metrics = app.requireService(MetricsService);
    const live = new Map<string, SpendHistory>();
    for (const agent of app.requireService(AgentManager).getAgents()) {
      try {
        live.set(agent.id, agent.getState(CostTrackingState).spendHistory);
      } catch {
        // Agent without metrics state: contributes nothing.
      }
    }
    const stored = await listStoredSafely(metrics);
    return bucketSpendSeries(collectSpendHistories(live, stored), args.range);
  },

  async listAgentMetricsHistory(_args, app: TokenRingApp) {
    const metrics = app.requireService(MetricsService);
    const live = app
      .requireService(AgentManager)
      .getAgents()
      .map((agent: Agent) => readAgentCosts(agent));
    let stored: Awaited<ReturnType<MetricsService["listAgentMetrics"]>> = [];
    try {
      stored = await metrics.listAgentMetrics();
    } catch (err) {
      console.warn("[MetricsService] Failed to list stored metrics:", err);
    }
    return { persisted: metrics.hasPersistence, items: buildHistoryList(live, stored) };
  },

  async getAgentMetricsHistory(args, app: TokenRingApp) {
    const metrics = app.requireService(MetricsService);
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (agent) {
      return { status: "success" as const, agent: readAgentCosts(agent), live: true, updatedAt: Date.now() };
    }
    const stored = await metrics.retrieveAgentMetrics(args.agentId);
    if (!stored) return { status: "agentNotFound" as const };
    return {
      status: "success" as const,
      agent: agentCostsFromMetrics(stored.metrics, {
        agentId: stored.agentId,
        displayName: stored.metrics.identity?.displayName ?? stored.agentId,
        agentType: stored.metrics.identity?.agentType ?? "unknown",
        idle: true,
      }),
      live: false,
      updatedAt: stored.updatedAt,
    };
  },
});

async function listStoredSafely(metrics: MetricsService): Promise<StoredAgentMetrics[]> {
  try {
    return await metrics.listAllAgentMetrics();
  } catch (err) {
    console.warn("[MetricsService] Failed to list stored metrics for spend series:", err);
    return [];
  }
}
