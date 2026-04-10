import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand,} from "@tokenring-ai/agent/types";
import {CostTrackingState} from "../state/costTrackingState.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

const description = "Displays total costs incurred by the Agent." as const;

const help: string = `Displays total costs incurred by the Agent, including AI Chat, Image Generation, and Web Search costs.

## Notes
- Costs are summed from the beginning of the current session until the current time
- Costs are displayed in USD
`;

export default {
  name: "costs",
  description,
  inputSchema,
  execute: ({agent}: AgentCommandInputType<typeof inputSchema>): string => {
    return agent.getState(CostTrackingState).show();
  },
  help,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
