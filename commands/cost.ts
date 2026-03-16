import {Agent} from "@tokenring-ai/agent";
import type {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {CostTrackingState} from "../state/costTrackingState.ts";

const description = "Displays total costs incurred by the Agent." as const;
export function execute(remainder: string, agent: Agent): string {
  const lines = agent.getState(CostTrackingState).show();

  return lines.join("\n");
}

const help: string = `# /costs

## Description
Displays total costs incurred by the Agent, including AI Chat, Image Generation, and Web Search costs.

## Commands
- **(no argument)** - Shows total costs incurred by the Agent

## Notes
- Costs are summed from the beginning of the current session until the current time
- Costs are displayed in USD
`;

export default {
  name: "costs",
  description,
  execute,
  help,
} satisfies TokenRingAgentCommand;
