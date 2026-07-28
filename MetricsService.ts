import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingService } from "@tokenring-ai/app/types";
import type { z } from "zod";
import { MetricsServiceConfigSchema } from "./schema.ts";
import { CostTrackingState } from "./state/costTrackingState.ts";

type MetricsServiceConfig = z.output<typeof MetricsServiceConfigSchema>;

export default class MetricsService implements TokenRingService {
  readonly name = "MetricsService";
  description = "Collects metrics about the agent's performance.";

  private options = MetricsServiceConfigSchema.parse({});

  constructor(options?: MetricsServiceConfig) {
    if (options) this.options = options;
  }

  reconfigure(options: MetricsServiceConfig): void {
    this.options = options;
  }

  attach(agent: Agent): void {
    agent.initializeState(CostTrackingState, {});
  }

  addCost(category: string, amount: number, agent: Agent) {
    agent.mutateState(CostTrackingState, state => {
      state.costs[category] = (state.costs[category] ?? 0) + amount;
    });
  }
}
