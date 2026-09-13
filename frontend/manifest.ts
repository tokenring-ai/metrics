import { DollarSign } from "lucide-react";
import type { PluginAppManifest } from "@tokenring-ai/one-frontend/plugins/types.ts";

/**
 * Metadata for the metrics app shipped by this plugin. The frontend merges
 * this into its app registry and derives the SPA server routes from it.
 */
export default {
  id: "metrics",
  path: "/metrics",
  label: "Metrics",
  shortLabel: "MT",
  description: "Live cost tracking across agents and models",
  group: "System",
  icon: DollarSign,
  iconClass: "text-emerald-500",
  gradient: "from-emerald-500 to-teal-600",
} satisfies PluginAppManifest;
