import type Agent from "@tokenring-ai/agent/Agent";
import { AgentEventState } from "@tokenring-ai/agent/state/agentEventState";
import type { AgentCosts, CostSummary } from "./rpc/schema.ts";
import { CostTrackingState } from "./state/costTrackingState.ts";

export function readAgentCosts(agent: Agent): AgentCosts {
  let costs: Record<string, number>;
  try {
    costs = { ...agent.getState(CostTrackingState).costs };
  } catch {
    costs = {};
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
  };
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
  };
}
