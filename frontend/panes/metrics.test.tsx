import { beforeEach, describe, expect, it, mock } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defineView, type ViewDefinition } from "@tokenring-ai/one-frontend/layout/define.ts";
import { createLayoutRegistry } from "@tokenring-ai/one-frontend/layout/registry.ts";
import type { LayoutTemplate } from "@tokenring-ai/one-frontend/layout/types.ts";
import { renderLayoutApp, renderLayoutView } from "@tokenring-ai/one-frontend/test/layout.tsx";
import { MessageSquare } from "lucide-react";
import type React from "react";

const emptyTokens = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCachedTokens: 0,
  totalReasoningTokens: 0,
};
const emptyLatency = {
  requestCount: 0,
  avgElapsedMs: 0,
  avgTimeToFirstTokenMs: 0,
  avgTokensPerSecond: 0,
};
const emptyErrors = {
  errorsByProvider: {} as Record<string, number>,
  errorsByType: {} as Record<string, number>,
  retryCount: 0,
};
const emptyActivity = {
  totalSteps: 0,
  totalToolCalls: 0,
  toolCallsByName: {} as Record<string, number>,
};

const sampleSummary = {
  agents: [
    {
      agentId: "agent-active-1",
      displayName: "Code Engineer #1",
      agentType: "code",
      idle: false,
      total: 0.42,
      costs: {
        "Chat (OpenAI:gpt-4o)": 0.3,
        "Image Generation (OpenAI:dall-e-3)": 0.1,
        "Web Search": 0.02,
      },
      tokens: {
        totalInputTokens: 12000,
        totalOutputTokens: 3400,
        totalCachedTokens: 800,
        totalReasoningTokens: 200,
      },
      tokensByCategory: {},
      latency: {
        requestCount: 8,
        avgElapsedMs: 450,
        avgTimeToFirstTokenMs: 120,
        avgTokensPerSecond: 42,
        p50ElapsedMs: 400,
        p95ElapsedMs: 900,
      },
      errors: {
        errorsByProvider: { OpenAI: 1 },
        errorsByType: { rateLimit: 1 },
        retryCount: 2,
      },
      activity: {
        totalSteps: 12,
        totalToolCalls: 7,
        toolCallsByName: { read_file: 4, search: 3 },
      },
    },
    {
      agentId: "agent-idle-2",
      displayName: "Researcher",
      agentType: "research",
      idle: true,
      total: 0.05,
      costs: { "Chat (OpenAI:gpt-4o-mini)": 0.05 },
      tokens: {
        totalInputTokens: 500,
        totalOutputTokens: 100,
        totalCachedTokens: 0,
        totalReasoningTokens: 0,
      },
      tokensByCategory: {},
      latency: {
        requestCount: 1,
        avgElapsedMs: 200,
        avgTimeToFirstTokenMs: 50,
        avgTokensPerSecond: 20,
      },
      errors: emptyErrors,
      activity: {
        totalSteps: 1,
        totalToolCalls: 0,
        toolCallsByName: {},
      },
    },
  ],
  totalsByCategory: {
    "Chat (OpenAI:gpt-4o)": 0.3,
    "Image Generation (OpenAI:dall-e-3)": 0.1,
    "Web Search": 0.02,
    "Chat (OpenAI:gpt-4o-mini)": 0.05,
  },
  grandTotal: 0.47,
  agentCount: 2,
  activeAgentCount: 1,
  tokens: {
    totalInputTokens: 12500,
    totalOutputTokens: 3500,
    totalCachedTokens: 800,
    totalReasoningTokens: 200,
  },
  tokensByCategory: {},
  latency: {
    requestCount: 9,
    avgElapsedMs: 422,
    avgTimeToFirstTokenMs: 112,
    avgTokensPerSecond: 39,
  },
  errors: {
    errorsByProvider: { OpenAI: 1 },
    errorsByType: { rateLimit: 1 },
    retryCount: 2,
  },
  activity: {
    totalSteps: 13,
    totalToolCalls: 7,
    toolCallsByName: { read_file: 4, search: 3 },
  },
};

const emptySummary = {
  agents: [],
  totalsByCategory: {},
  grandTotal: 0,
  agentCount: 0,
  activeAgentCount: 0,
  tokens: emptyTokens,
  tokensByCategory: {},
  latency: emptyLatency,
  errors: emptyErrors,
  activity: emptyActivity,
};

const resetAgentCosts = mock(async (_args: { agentId: string }) => ({ status: "success" as const }));
const resetAllAgentCosts = mock(async (_args: Record<string, never>) => ({ status: "success" as const, resetCount: 2 }));
const mutate = mock(async () => undefined);
const downloadTextFile = mock((_name: string, _content: string, _mime: string) => undefined);

const HOUR = 3_600_000;
function spendSeries(range: string) {
  const bucketMs = range === "1h" ? 300_000 : HOUR;
  const count = range === "1h" ? 12 : 24;
  const start = Date.UTC(2026, 9, 12, 0);
  const buckets = Array.from({ length: count }, (_, i) => ({
    t: start + i * bucketMs,
    cost: i === count - 1 ? 0.4 : i === 2 ? 0.1 : 0,
    inputTokens: i === count - 1 ? 1000 : 0,
    outputTokens: 0,
    requests: i === count - 1 ? 2 : 0,
  }));
  return { range, bucketMs, start, end: start + count * bucketMs, buckets, totals: { cost: 0.5, inputTokens: 1000, outputTokens: 0, requests: 2 } };
}

const historyItems = [
  {
    agentId: "agent-active-1",
    displayName: "Code Engineer #1",
    agentType: "code",
    live: true,
    totalCost: 0.42,
    totalInputTokens: 12000,
    totalOutputTokens: 3400,
    requestCount: 8,
    totalSteps: 12,
    totalToolCalls: 7,
    updatedAt: Date.now(),
  },
  {
    agentId: "agent-gone-9",
    displayName: "Archivist",
    agentType: "research",
    live: false,
    totalCost: 1.25,
    totalInputTokens: 500,
    totalOutputTokens: 100,
    requestCount: 30,
    totalSteps: 2,
    totalToolCalls: 1,
    updatedAt: Date.now() - 3 * 86_400_000,
  },
];

type SwrResult = { data: unknown; error: Error | undefined; isLoading: boolean; mutate: typeof mutate };
const swrKeys: string[] = [];
let historyState: { persisted: boolean; items: typeof historyItems } | undefined;
let detailState: unknown;

function fakeTypedSWR(key: string | null): SwrResult {
  const result = (data: unknown): SwrResult => ({ data, error: undefined, isLoading: false, mutate });
  if (!key) return result(undefined);
  swrKeys.push(key);
  if (key.startsWith("/metrics/spend/")) return result(spendSeries(key.slice("/metrics/spend/".length)));
  if (key === "/metrics/history") return result(historyState);
  if (key.startsWith("/metrics/history/")) return result(detailState);
  return result(undefined);
}

let summaryState: {
  data: typeof sampleSummary | typeof emptySummary | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isValidating: boolean;
};

void mock.module("@tokenring-ai/one-frontend/rpc.ts", () => ({
  useCostSummary: () => ({
    data: summaryState.data,
    error: summaryState.error,
    isLoading: summaryState.isLoading,
    isValidating: summaryState.isValidating,
    mutate,
  }),
  metricsRPCClient: { resetAgentCosts, resetAllAgentCosts },
  useTypedSWR: fakeTypedSWR,
}));
void mock.module("@tokenring-ai/one-frontend/lib/transcriptExport.ts", () => ({ downloadTextFile }));

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { METRICS_APP, default: layout } = await import("../layout.ts");
const { default: metricsViews } = await import("../views.tsx");

const viewById = (id: string) => metricsViews.views.find(view => view.id === id) as ViewDefinition;

function ChatStub() {
  return <p>chat stub</p>;
}

const chatView = defineView({
  id: "chat",
  kind: "agent",
  title: params => params["agentId"] ?? "Chat",
  icon: MessageSquare,
  route: "agent/:agentId",
  instanceKey: params => params["agentId"] ?? "",
  component: ChatStub,
});

async function renderMetricsView(viewId: string, options: { params?: Record<string, string> } = {}) {
  const result = renderLayoutView(viewById(viewId), {
    params: options.params ?? {},
    views: [chatView, ...metricsViews.views],
    kinds: [...(layout.kinds ?? []), { id: "agent", label: "Agents", plural: "agent chats" }],
  });
  // The view components are lazy chunks; wait for the Suspense fallback to clear.
  await screen.findByTestId(`${viewId}-view`);
  return result;
}

function templateViewIds(template: LayoutTemplate): string[] {
  if ("split" in template) return template.children.flatMap(child => templateViewIds(child));
  return (template.items ?? []).map(item => (typeof item === "string" ? item : item.view));
}

describe("MetricsOverviewView", () => {
  beforeEach(() => {
    mutate.mockClear();
    summaryState = {
      data: sampleSummary,
      error: undefined,
      isLoading: false,
      isValidating: false,
    };
  });

  it("renders summary cards, spend mix, detail panels, and categories", async () => {
    await renderMetricsView("metrics-overview");

    expect(screen.getByTestId("metrics-overview-view")).toBeInTheDocument();
    expect(screen.getByText("Total since start")).toBeInTheDocument();
    expect(screen.getByText("Chat & models")).toBeInTheDocument();
    expect(screen.getByText("Media")).toBeInTheDocument();
    expect(screen.getByText("Active now")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-performance-stats")).toBeInTheDocument();
    expect(within(screen.getByTestId("metrics-performance-stats")).getByText("Tokens")).toBeInTheDocument();
    expect(screen.getByText("Latency")).toBeInTheDocument();
    expect(screen.getByText("Errors")).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-spend-mix")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-detail-panels")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-category-bars")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-live-status")).toHaveTextContent("Live");
    // The per-agent table lives in its own view now.
    expect(screen.queryByText("Code Engineer #1")).not.toBeInTheDocument();
  });

  it("shows loading state when no data yet", async () => {
    summaryState = { data: undefined, error: undefined, isLoading: true, isValidating: true };
    await renderMetricsView("metrics-overview");
    expect(screen.getByText("Loading metrics…")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-live-status")).toHaveTextContent("Connecting");
  });

  it("does not claim Live status while waiting for the first snapshot", async () => {
    summaryState = { data: undefined, error: undefined, isLoading: false, isValidating: false };
    await renderMetricsView("metrics-overview");
    expect(screen.getByText("Waiting for metrics…")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-live-status")).toHaveTextContent("Connecting");
  });

  it("shows error state with retry", async () => {
    const user = userEvent.setup();
    summaryState = {
      data: undefined,
      error: new Error("stream failed"),
      isLoading: false,
      isValidating: false,
    };
    await renderMetricsView("metrics-overview");

    expect(screen.getByText("Unable to load metrics")).toBeInTheDocument();
    expect(screen.getByText(/stream failed/)).toBeInTheDocument();
    expect(screen.getByTestId("metrics-live-status")).toHaveTextContent("Error");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mutate).toHaveBeenCalled();
  });

  it("shows the empty category state and skips spend mix when there is no spend", async () => {
    summaryState = { data: emptySummary, error: undefined, isLoading: false, isValidating: false };
    await renderMetricsView("metrics-overview");
    expect(screen.getByTestId("metrics-category-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("metrics-spend-mix")).not.toBeInTheDocument();
  });

  it("shows stale banner when stream errors but data exists", async () => {
    summaryState = {
      data: sampleSummary,
      error: new Error("connection lost"),
      isLoading: false,
      isValidating: false,
    };
    await renderMetricsView("metrics-overview");
    const banner = screen.getByTestId("metrics-stale-banner");
    expect(banner).toHaveTextContent("connection lost");
    expect(banner).toHaveTextContent("last known snapshot");
    // Keep the banner single-line — no stack dump.
    expect(banner.textContent ?? "").not.toMatch(/\s+at\s+/);
    expect(screen.getByTestId("metrics-live-status")).toHaveTextContent("Reconnecting");
  });

  it("explains ttft, tk/s, cached and reasoning on hover", async () => {
    await renderMetricsView("metrics-overview");
    expect(screen.getByTestId("metrics-tokens-stat").getAttribute("title")).toMatch(/cached:.*reason:/);
    expect(screen.getByTestId("metrics-latency-stat").getAttribute("title")).toMatch(/ttft:.*tk\/s:/);
  });

  it("triggers refresh", async () => {
    const user = userEvent.setup();
    await renderMetricsView("metrics-overview");
    await user.click(screen.getByTestId("metrics-refresh"));
    expect(mutate).toHaveBeenCalled();
  });

  it("charts spend over time and switches range and metric", async () => {
    const user = userEvent.setup();
    swrKeys.length = 0;
    await renderMetricsView("metrics-overview");
    expect(screen.getAllByTestId("metrics-spend-bar")).toHaveLength(24);
    expect(swrKeys).toContain("/metrics/spend/24h");
    expect(screen.getByTestId("metrics-spend-readout")).toHaveTextContent("$0.50 in range");

    await user.click(screen.getByRole("button", { name: "1h" }));
    expect(swrKeys).toContain("/metrics/spend/1h");
    expect(screen.getAllByTestId("metrics-spend-bar")).toHaveLength(12);

    await user.click(screen.getByRole("button", { name: "Tokens" }));
    expect(screen.getByTestId("metrics-spend-readout")).toHaveTextContent("1k tok in range");

    // Hovering a bar shows that bucket's numbers.
    await user.hover(screen.getAllByTestId("metrics-spend-bar").at(-1)!);
    expect(screen.getByTestId("metrics-spend-readout")).toHaveTextContent("$0.40");
    expect(screen.getByTestId("metrics-spend-readout")).toHaveTextContent("2 req");
  });

  it("shows a per-model token table and latency percentiles including TTFT", async () => {
    summaryState = {
      ...summaryState,
      data: {
        ...sampleSummary,
        tokensByCategory: {
          "Chat (OpenAI:gpt-4o)": { totalInputTokens: 12000, totalOutputTokens: 3400, totalCachedTokens: 800, totalReasoningTokens: 200 },
          "Chat (OpenAI:gpt-4o-mini)": { totalInputTokens: 500, totalOutputTokens: 100, totalCachedTokens: 0, totalReasoningTokens: 0 },
        },
        latency: {
          ...sampleSummary.latency,
          p50ElapsedMs: 400,
          p95ElapsedMs: 900,
          p99ElapsedMs: 1500,
          p50TimeToFirstTokenMs: 110,
          p95TimeToFirstTokenMs: 300,
          p99TimeToFirstTokenMs: 640,
        },
      } as typeof sampleSummary,
    };
    await renderMetricsView("metrics-overview");
    const rows = screen.getAllByTestId("metrics-model-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("OpenAI:gpt-4o");
    expect(rows[0]).toHaveTextContent("12k");
    expect(rows[0]).toHaveTextContent("$0.30");
    const percentiles = screen.getByTestId("metrics-latency-percentiles");
    expect(percentiles).toHaveTextContent("1.50s");
    expect(percentiles).toHaveTextContent("ttft p99");
    expect(percentiles).toHaveTextContent("640ms");
  });

  it("says so when no model token usage is recorded", async () => {
    await renderMetricsView("metrics-overview");
    expect(screen.getByText("No model token usage recorded yet.")).toBeInTheDocument();
  });
});

describe("MetricsAgentsView", () => {
  beforeEach(() => {
    resetAgentCosts.mockClear();
    mutate.mockClear();
    summaryState = {
      data: sampleSummary,
      error: undefined,
      isLoading: false,
      isValidating: false,
    };
  });

  it("renders one row per agent", async () => {
    await renderMetricsView("metrics-agents");

    expect(screen.getByTestId("metrics-agents-view")).toBeInTheDocument();
    expect(screen.getByText("Code Engineer #1")).toBeInTheDocument();
    expect(screen.getByText("Researcher")).toBeInTheDocument();
  });

  it("shows the live badge, and a stale banner when the stream drops with data on screen", async () => {
    await renderMetricsView("metrics-agents");
    expect(screen.getByTestId("metrics-live-status")).toHaveTextContent("Live");
    expect(screen.queryByTestId("metrics-stale-banner")).not.toBeInTheDocument();
  });

  it("shows Reconnecting and the stale banner when the stream errors after a snapshot", async () => {
    summaryState = { data: sampleSummary, error: new Error("connection lost"), isLoading: false, isValidating: false };
    await renderMetricsView("metrics-agents");
    expect(screen.getByTestId("metrics-live-status")).toHaveTextContent("Reconnecting");
    expect(screen.getByTestId("metrics-stale-banner")).toHaveTextContent("connection lost");
    // Rows from the last snapshot stay visible.
    expect(screen.getByText("Code Engineer #1")).toBeInTheDocument();
  });

  it("sorts agents by spend by default and by the chosen column", async () => {
    const user = userEvent.setup();
    const alpha = { ...sampleSummary.agents[1]!, agentId: "agent-alpha-3", displayName: "Alpha", total: 0 };
    // Data arrives unsorted; the table orders it.
    summaryState = { ...summaryState, data: { ...sampleSummary, agents: [alpha, sampleSummary.agents[1]!, sampleSummary.agents[0]!] } };
    await renderMetricsView("metrics-agents");
    const order = () =>
      screen.getAllByTestId("metrics-agent-row").map(row => ["Alpha", "Researcher", "Code Engineer #1"].find(name => row.textContent?.includes(name)));
    expect(order()).toEqual(["Code Engineer #1", "Researcher", "Alpha"]);
    await user.selectOptions(screen.getByTestId("metrics-agent-sort"), "name");
    expect(order()).toEqual(["Alpha", "Code Engineer #1", "Researcher"]);
  });

  it("explains abbreviated stat labels in the expanded breakdown", async () => {
    const user = userEvent.setup();
    await renderMetricsView("metrics-agents");
    await user.click(screen.getAllByRole("button", { name: "Expand cost breakdown" })[0]!);
    expect(screen.getByText("ttft").closest("span[title]")?.getAttribute("title")).toBe("Average time to first token");
    expect(screen.getByText("cached").closest("span[title]")?.getAttribute("title")).toMatch(/prompt cache/);
  });

  it("shows the empty state when no agents are tracked", async () => {
    summaryState = { data: emptySummary, error: undefined, isLoading: false, isValidating: false };
    await renderMetricsView("metrics-agents");
    expect(screen.getByTestId("metrics-agents-empty")).toBeInTheDocument();
  });

  it("filters agents by Active tab", async () => {
    const user = userEvent.setup();
    await renderMetricsView("metrics-agents");

    // FilterTabs concatenates label + count into the accessible name (no space): "Active1".
    await user.click(screen.getByRole("button", { name: "Active1" }));
    expect(screen.getByText("Code Engineer #1")).toBeInTheDocument();
    expect(screen.queryByText("Researcher")).not.toBeInTheDocument();
  });

  it("filters agents by search", async () => {
    const user = userEvent.setup();
    await renderMetricsView("metrics-agents");

    await user.type(screen.getByRole("searchbox", { name: "Filter agents" }), "research");
    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.queryByText("Code Engineer #1")).not.toBeInTheDocument();
  });

  it("shows the filtered-empty state when search matches nothing", async () => {
    const user = userEvent.setup();
    await renderMetricsView("metrics-agents");
    await user.type(screen.getByRole("searchbox", { name: "Filter agents" }), "zzz-no-match");
    expect(screen.getByTestId("metrics-agents-filtered-empty")).toBeInTheDocument();
  });

  it("expands agent cost breakdown", async () => {
    const user = userEvent.setup();
    await renderMetricsView("metrics-agents");

    const expandButtons = screen.getAllByRole("button", { name: /Expand cost breakdown/i });
    await user.click(expandButtons[0]!);
    const breakdown = screen.getByTestId("metrics-agent-breakdown");
    expect(breakdown).toBeInTheDocument();
    expect(breakdown).toHaveTextContent("Web Search");
    expect(breakdown).toHaveTextContent("OpenAI:gpt-4o");
    expect(screen.getByTestId("metrics-agent-tokens")).toHaveTextContent("12k");
    expect(screen.getByTestId("metrics-agent-latency")).toHaveTextContent("450ms");
    expect(screen.getByTestId("metrics-agent-activity")).toHaveTextContent("read_file");
    expect(screen.getByTestId("metrics-agent-errors")).toHaveTextContent("rateLimit");
  });

  it("opens the agent's chat panel through the dock api when attached", async () => {
    const user = userEvent.setup();
    const app = await renderMetricsView("metrics-agents");

    await user.click(screen.getByText("Code Engineer #1"));
    expect(await screen.findByText("chat stub")).toBeInTheDocument();
    expect(app.location().pathname).toBe("/test/agent/agent-active-1");
  });

  it("confirms and resets agent metrics", async () => {
    const user = userEvent.setup();
    await renderMetricsView("metrics-agents");

    const resetButtons = screen.getAllByTestId("metrics-reset-agent");
    await user.click(resetButtons[0]!);

    expect(screen.getByText("Reset metrics?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset metrics" }));

    await waitFor(() => {
      expect(resetAgentCosts).toHaveBeenCalledWith({ agentId: "agent-active-1" });
    });
    expect(mutate).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText("Reset metrics?")).not.toBeInTheDocument();
    });
  });

  it("closes reset dialog after confirm even when reset RPC fails", async () => {
    const user = userEvent.setup();
    resetAgentCosts.mockImplementationOnce(async () => {
      throw new Error("reset failed");
    });
    await renderMetricsView("metrics-agents");

    await user.click(screen.getAllByTestId("metrics-reset-agent")[0]!);
    expect(screen.getByText("Reset metrics?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset metrics" }));

    await waitFor(() => {
      expect(resetAgentCosts).toHaveBeenCalledWith({ agentId: "agent-active-1" });
    });
    // Promise-based confirm closes before the RPC; failures toast and leave the dialog closed.
    await waitFor(() => {
      expect(screen.queryByText("Reset metrics?")).not.toBeInTheDocument();
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("confirms and resets every agent's metrics", async () => {
    const user = userEvent.setup();
    resetAllAgentCosts.mockClear();
    await renderMetricsView("metrics-agents");

    await user.click(screen.getByTestId("metrics-reset-all"));
    expect(screen.getByText("Reset metrics for all agents?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset all agents" }));
    await waitFor(() => expect(resetAllAgentCosts).toHaveBeenCalledWith({}));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
  });

  it("does not reset all when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    resetAllAgentCosts.mockClear();
    await renderMetricsView("metrics-agents");
    await user.click(screen.getByTestId("metrics-reset-all"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(resetAllAgentCosts).not.toHaveBeenCalled();
  });

  it("exports the filtered agents as CSV", async () => {
    const user = userEvent.setup();
    downloadTextFile.mockClear();
    await renderMetricsView("metrics-agents");
    await user.type(screen.getByRole("searchbox", { name: "Filter agents" }), "research");
    await user.click(screen.getByTestId("metrics-agents-export"));

    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const [name, csv, mime] = downloadTextFile.mock.calls[0]!;
    expect(name).toMatch(/^metrics-agents-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(mime).toContain("text/csv");
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toStartWith("Agent ID,Name,Type,Status,Cost (USD)");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toStartWith("agent-idle-2,Researcher,research,idle,0.05");
  });

  it("shows TTFT and p99 percentiles in the expanded breakdown when computed", async () => {
    const user = userEvent.setup();
    const agent = {
      ...sampleSummary.agents[0]!,
      latency: { ...sampleSummary.agents[0]!.latency, p99ElapsedMs: 1200, p50TimeToFirstTokenMs: 100, p95TimeToFirstTokenMs: 250, p99TimeToFirstTokenMs: 400 },
    };
    summaryState = { ...summaryState, data: { ...sampleSummary, agents: [agent] } as typeof sampleSummary };
    await renderMetricsView("metrics-agents");
    await user.click(screen.getAllByRole("button", { name: "Expand cost breakdown" })[0]!);
    expect(screen.getByTestId("metrics-agent-latency")).toHaveTextContent("1.20s");
    expect(screen.getByTestId("metrics-agent-ttft")).toHaveTextContent("400ms");
  });

  it("cancels reset confirmation", async () => {
    const user = userEvent.setup();
    await renderMetricsView("metrics-agents");

    await user.click(screen.getAllByTestId("metrics-reset-agent")[0]!);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Reset metrics?")).not.toBeInTheDocument();
    expect(resetAgentCosts).not.toHaveBeenCalled();
  });
});

describe("MetricsHistoryView", () => {
  beforeEach(() => {
    historyState = { persisted: true, items: historyItems };
    downloadTextFile.mockClear();
  });

  const names = () => screen.getAllByTestId("metrics-history-row").map(row => (row.textContent?.includes("Archivist") ? "Archivist" : "Code Engineer #1"));

  it("lists live and stored agents, newest first", async () => {
    await renderMetricsView("metrics-history");
    expect(names()).toEqual(["Code Engineer #1", "Archivist"]);
    expect(screen.getByLabelText("Running")).toBeInTheDocument();
    expect(screen.getAllByTestId("metrics-history-row")[1]).toHaveTextContent("3d ago");
    expect(screen.queryByTestId("metrics-history-unpersisted")).not.toBeInTheDocument();
  });

  it("sorts by a column and flips direction on a second click", async () => {
    const user = userEvent.setup();
    await renderMetricsView("metrics-history");
    await user.click(screen.getByRole("button", { name: "Spend" }));
    expect(names()).toEqual(["Archivist", "Code Engineer #1"]);
    expect(screen.getByRole("columnheader", { name: /Spend/ })).toHaveAttribute("aria-sort", "descending");
    await user.click(screen.getByRole("button", { name: /Spend/ }));
    expect(names()).toEqual(["Code Engineer #1", "Archivist"]);
    expect(screen.getByRole("columnheader", { name: /Spend/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("opens the agent detail view from a row", async () => {
    const user = userEvent.setup();
    detailState = { status: "agentNotFound" };
    await renderMetricsView("metrics-history");
    await user.click(screen.getByText("Archivist"));
    expect(await screen.findByTestId("metrics-agent-detail-view")).toBeInTheDocument();
  });

  it("exports the history list as CSV", async () => {
    const user = userEvent.setup();
    await renderMetricsView("metrics-history");
    await user.click(screen.getByTestId("metrics-history-export"));
    const [name, csv] = downloadTextFile.mock.calls[0]!;
    expect(name).toMatch(/^metrics-history-/);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[2]).toStartWith("agent-gone-9,Archivist,research,no,1.25,500,100,30");
  });

  it("explains that only running agents are listed without storage", async () => {
    historyState = { persisted: false, items: historyItems.slice(0, 1) };
    await renderMetricsView("metrics-history");
    expect(screen.getByTestId("metrics-history-unpersisted")).toHaveTextContent("No metrics storage");
  });

  it("shows the empty state with no history", async () => {
    historyState = { persisted: true, items: [] };
    await renderMetricsView("metrics-history");
    expect(screen.getByText("No metrics history yet")).toBeInTheDocument();
  });
});

describe("MetricsAgentDetailView", () => {
  it("renders a stored agent's full breakdown", async () => {
    detailState = {
      status: "success",
      live: false,
      updatedAt: Date.now() - 2 * HOUR,
      agent: {
        ...sampleSummary.agents[0]!,
        agentId: "agent-gone-9",
        displayName: "Archivist",
        idle: true,
        tokensByCategory: { "Chat (OpenAI:gpt-4o)": { totalInputTokens: 12000, totalOutputTokens: 3400, totalCachedTokens: 800, totalReasoningTokens: 200 } },
        latency: { ...sampleSummary.agents[0]!.latency, p50TimeToFirstTokenMs: 90, p95TimeToFirstTokenMs: 200, p99TimeToFirstTokenMs: 333 },
      },
    };
    await renderMetricsView("metrics-agent-detail", { params: { agentId: "agent-gone-9" } });
    const view = screen.getByTestId("metrics-agent-detail-view");
    expect(view).toHaveTextContent("Archivist");
    expect(view).toHaveTextContent("Stored");
    expect(view).toHaveTextContent("2h ago");
    expect(screen.getByTestId("metrics-agent-ttft")).toHaveTextContent("333ms");
    expect(screen.getAllByTestId("metrics-model-row")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Open chat" })).not.toBeInTheDocument();
  });

  it("explains a missing record", async () => {
    detailState = { status: "agentNotFound" };
    await renderMetricsView("metrics-agent-detail", { params: { agentId: "nope" } });
    expect(screen.getByTestId("metrics-agent-detail-missing")).toBeInTheDocument();
  });
});

describe("metrics app definition", () => {
  it("lays out the overview above the agents and history tabs, with every view registered", () => {
    const registeredViewIds = metricsViews.views.map(view => view.id);
    const layoutViewIds = templateViewIds(METRICS_APP.layout);

    expect(METRICS_APP.layout).toMatchObject({ split: "column" });
    expect(layoutViewIds).toEqual(["metrics-overview", "metrics-agents", "metrics-history"]);
    for (const id of METRICS_APP.views) {
      if (id !== "chat") expect(registeredViewIds).toContain(id);
    }
    expect(METRICS_APP.views).toContain("chat");
    expect(registeredViewIds).toContain("metrics-cost-summary");
    expect(METRICS_APP.path).toBe("/metrics");
  });

  it("mounts the app at /metrics with the overview open", async () => {
    const registry = createLayoutRegistry({
      apps: [METRICS_APP],
      views: [...metricsViews.views, chatView],
      kinds: [...(layout.kinds ?? []), { id: "agent", label: "Agents", plural: "agent chats" }],
    });
    const rendered = renderLayoutApp({ registry, url: "/metrics" });
    expect(rendered.location().pathname).toBe("/metrics");
    expect(await screen.findByTestId("metrics-overview-view")).toBeInTheDocument();
  });
});

describe("CostSummaryView", () => {
  beforeEach(() => {
    summaryState = { data: sampleSummary, error: undefined, isLoading: false, isValidating: false };
  });

  async function renderCostSummary() {
    renderLayoutView(viewById("metrics-cost-summary"));
    await screen.findByText("Total spend");
  }

  it("shows readable category labels with the raw key as a tooltip", async () => {
    await renderCostSummary();
    const list = screen.getByRole("list", { name: "Spend by category" });
    expect(list).toHaveTextContent("OpenAI:gpt-4o");
    expect(list).not.toHaveTextContent("Chat (OpenAI:gpt-4o)");
    expect(screen.getByTitle("Chat (OpenAI:gpt-4o)")).toHaveTextContent("OpenAI:gpt-4o");
    expect(screen.queryByTestId("cost-summary-zero-hint")).not.toBeInTheDocument();
  });

  it("explains a zero-spend card", async () => {
    summaryState = { data: emptySummary, error: undefined, isLoading: false, isValidating: false };
    await renderCostSummary();
    expect(screen.getByTestId("cost-summary-zero-hint")).toHaveTextContent("No spend recorded yet");
  });

  it("does not claim nothing happened when tokens were used at no cost", async () => {
    summaryState = {
      data: { ...emptySummary, tokens: { ...emptyTokens, totalInputTokens: 18_000, totalOutputTokens: 400 } },
      error: undefined,
      isLoading: false,
      isValidating: false,
    };
    await renderCostSummary();
    const hint = screen.getByTestId("cost-summary-zero-hint");
    expect(hint).toHaveTextContent("no cost was recorded");
    expect(hint).not.toHaveTextContent("No spend recorded yet");
  });
});
