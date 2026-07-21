import { AgentManager } from "@tokenring-ai/agent";
import type Agent from "@tokenring-ai/agent/Agent";
import { ChatModelRegistry } from "@tokenring-ai/ai-client/ModelRegistry";
import type TokenRingApp from "@tokenring-ai/app";
import ChatService from "@tokenring-ai/chat/ChatService";
import { ChatServiceState } from "@tokenring-ai/chat/state/chatServiceState";
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

function projectAgentStatus(agent: Agent) {
  const state = agent.getState(ChatServiceState);
  const model = agent.requireServiceByType(ChatService).getModel(agent);
  const maxContextLength = model ? agent.requireServiceByType(ChatModelRegistry).getClient(model).getModelSpec().maxContextLength : null;
  const lastResponse = state.messages.at(-1)?.response;
  const tokens = lastResponse ? (lastResponse.totalUsage.inputTokens ?? 0) + (lastResponse.totalUsage.outputTokens ?? 0) : 0;
  const lastStepTokens = lastResponse ? (lastResponse.lastStepUsage.inputTokens ?? 0) + (lastResponse.lastStepUsage.outputTokens ?? 0) : 0;
  const cost = state.messages.reduce((total, message) => total + (message.response.cost.total ?? 0), 0);
  const contextPercentLeft =
    maxContextLength !== null && maxContextLength > 0 ? Math.round(Math.max(0, Math.min(1, 1 - lastStepTokens / maxContextLength)) * 100) : null;

  return {
    status: "success" as const,
    model,
    maxContextLength,
    tools: state.currentConfig.enabledTools.length,
    tokens,
    cost,
    contextPercentLeft,
  };
}

export default createRPCEndpoint(MetricsRpcSchema, {
  getCostSummary(_args, app: TokenRingApp) {
    return projectCostSummary(app);
  },

  streamCostSummary,

  async *streamAgentStatus(args, app: TokenRingApp, signal) {
    app.requireService(MetricsService);
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      yield { status: "agentNotFound" as const };
      return;
    }
    for await (const _state of agent.subscribeStateAsync(ChatServiceState, signal)) {
      yield projectAgentStatus(agent);
    }
  },

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
