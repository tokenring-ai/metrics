import type {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import cost from "./commands/cost.ts";

export default [
  cost
] as const satisfies readonly TokenRingAgentCommand<any>[];
