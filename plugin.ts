import { AgentCommandService } from "@tokenring-ai/agent";
import type { TokenRingPlugin } from "@tokenring-ai/app";
import { RpcService } from "@tokenring-ai/rpc";
import { z } from "zod";
import agentCommands from "./commands.ts";
import MetricsService from "./MetricsService.ts";
import packageJSON from "./package.json" with { type: "json" };
import metricsRPC from "./rpc/metrics.ts";
import { MetricsServiceConfigSchema } from "./schema.ts";

const packageConfigSchema = z.object({
  metrics: MetricsServiceConfigSchema,
});

export default {
  name: packageJSON.name,
  displayName: "Metrics & Monitoring",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    app.addServices(new MetricsService(config.metrics));
    app.waitForService(AgentCommandService, agentCommandService => {
      agentCommandService.addAgentCommands(...agentCommands);
    });
    app.waitForService(RpcService, rpcService => {
      rpcService.registerEndpoint(metricsRPC);
    });
  },
  configSchema: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
