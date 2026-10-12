import { describe, expect, test } from "bun:test";
import {
  bucketTotals,
  categoryKind,
  categoryShares,
  filterAgents,
  formatAgentIdShort,
  formatBucketLabel,
  formatCount,
  formatMs,
  formatPercent,
  formatRelativeTime,
  formatTps,
  formatUsd,
  modelTokenRows,
  shortCategoryLabel,
  sortAgents,
  sortHistory,
  sumRecord,
  topRecordEntries,
} from "./formatters.ts";

describe("formatUsd", () => {
  test("formats zero", () => {
    expect(formatUsd(0)).toBe("$0.00");
  });

  test("formats typical amounts with up to 4 decimals", () => {
    expect(formatUsd(1.23456)).toBe("$1.2346");
  });

  test("uses higher precision for tiny amounts", () => {
    expect(formatUsd(0.00042)).toBe("$0.00042");
  });

  test("places the minus sign before the dollar sign", () => {
    expect(formatUsd(-1.5)).toBe("-$1.50");
    expect(formatUsd(-0.00042)).toBe("-$0.00042");
  });

  test("uses en-US grouping for large amounts", () => {
    expect(formatUsd(1234.5)).toBe("$1,234.50");
  });

  test("handles non-finite", () => {
    expect(formatUsd(Number.NaN)).toBe("$0.00");
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe("$0.00");
  });
});

describe("formatPercent", () => {
  test("formats whole percents", () => {
    expect(formatPercent(0.75)).toBe("75%");
  });

  test("shows less-than-one for tiny shares", () => {
    expect(formatPercent(0.004)).toBe("<1%");
  });

  test("handles non-finite", () => {
    expect(formatPercent(Number.NaN)).toBe("0%");
  });
});

describe("formatCount", () => {
  test("formats zero and small counts", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(42)).toBe("42");
  });

  test("compacts thousands and millions", () => {
    expect(formatCount(1200)).toBe("1.2k");
    expect(formatCount(12500)).toBe("12.5k");
    expect(formatCount(2_500_000)).toBe("2.5M");
  });
});

describe("formatMs", () => {
  test("formats ms and seconds", () => {
    expect(formatMs(120)).toBe("120ms");
    expect(formatMs(1500)).toBe("1.50s");
    expect(formatMs(undefined)).toBe("—");
    expect(formatMs(0)).toBe("—");
  });
});

describe("formatTps", () => {
  test("formats throughput", () => {
    expect(formatTps(42.3)).toBe("42.3 tk/s");
    expect(formatTps(150)).toBe("150 tk/s");
    expect(formatTps(0)).toBe("—");
  });
});

describe("sumRecord / topRecordEntries", () => {
  test("sums and ranks records", () => {
    expect(sumRecord({ a: 1, b: 2 })).toBe(3);
    expect(topRecordEntries({ a: 1, b: 5, c: 3 }, 2)).toEqual([
      { key: "b", value: 5 },
      { key: "c", value: 3 },
    ]);
  });
});

describe("formatAgentIdShort", () => {
  test("truncates long ids", () => {
    expect(formatAgentIdShort("abcdefghijklmnop")).toBe("abcdefgh");
  });

  test("passes short ids through", () => {
    expect(formatAgentIdShort("abc")).toBe("abc");
  });

  test("handles empty", () => {
    expect(formatAgentIdShort("")).toBe("—");
  });
});

describe("shortCategoryLabel", () => {
  test("strips Chat wrapper", () => {
    expect(shortCategoryLabel("Chat (OpenAI:gpt-4o)")).toBe("OpenAI:gpt-4o");
  });

  test("labels image generation", () => {
    expect(shortCategoryLabel("Image Generation (OpenAI:dall-e-3)")).toBe("Image · OpenAI:dall-e-3");
  });

  test("labels video generation", () => {
    expect(shortCategoryLabel("Video Generation (Runway:gen-3)")).toBe("Video · Runway:gen-3");
  });

  test("labels structured generation", () => {
    expect(shortCategoryLabel("GenerateObject (OpenAI:gpt-4o)")).toBe("Object · OpenAI:gpt-4o");
  });

  test("passes through unknown labels", () => {
    expect(shortCategoryLabel("Web Search")).toBe("Web Search");
  });
});

describe("categoryKind", () => {
  test("classifies known prefixes", () => {
    expect(categoryKind("Chat (x)")).toBe("chat");
    expect(categoryKind("GenerateObject (x)")).toBe("chat");
    expect(categoryKind("Image Generation (x)")).toBe("image");
    expect(categoryKind("Video Generation (x)")).toBe("video");
    expect(categoryKind("Web Search")).toBe("other");
  });
});

describe("categoryShares", () => {
  test("sorts by amount and computes shares", () => {
    const shares = categoryShares({ a: 1, b: 3 }, 4);
    expect(shares.map(s => s.category)).toEqual(["b", "a"]);
    expect(shares[0]!.share).toBeCloseTo(0.75);
    expect(shares[1]!.share).toBeCloseTo(0.25);
  });

  test("handles zero total", () => {
    const shares = categoryShares({ a: 0 }, 0);
    expect(shares[0]!.share).toBe(0);
  });
});

describe("bucketTotals", () => {
  test("buckets chat vs media vs other", () => {
    const buckets = bucketTotals({
      "Chat (m)": 1,
      "Image Generation (m)": 2,
      "Video Generation (m)": 3,
      "Web Search": 4,
    });
    expect(buckets.chat).toBe(1);
    expect(buckets.media).toBe(5);
    expect(buckets.other).toBe(4);
  });
});

describe("filterAgents", () => {
  const agents = [
    { agentId: "a1", displayName: "Code #1", agentType: "code", idle: false },
    { agentId: "a2", displayName: "Researcher", agentType: "research", idle: true },
    { agentId: "a3", displayName: "Code #2", agentType: "code", idle: true },
  ];

  test("filters by status", () => {
    expect(filterAgents(agents, "all")).toHaveLength(3);
    expect(filterAgents(agents, "active").map(a => a.agentId)).toEqual(["a1"]);
    expect(filterAgents(agents, "idle").map(a => a.agentId)).toEqual(["a2", "a3"]);
  });

  test("filters by search", () => {
    expect(filterAgents(agents, "all", "research").map(a => a.agentId)).toEqual(["a2"]);
    expect(filterAgents(agents, "idle", "code").map(a => a.agentId)).toEqual(["a3"]);
  });
});

describe("sortAgents", () => {
  const agent = (displayName: string, total: number, tokens: number, requests: number, errors: number) => ({
    displayName,
    total,
    tokens: { totalInputTokens: tokens, totalOutputTokens: 0 },
    latency: { requestCount: requests },
    errors: { errorsByProvider: { p: errors }, errorsByType: {} },
  });
  const rows = [agent("b", 1, 10, 5, 0), agent("a", 2, 5, 1, 3), agent("c", 0, 20, 2, 1)];
  const names = (sorted: { displayName: string }[]) => sorted.map(row => row.displayName);

  test("orders numeric keys descending and names ascending", () => {
    expect(names(sortAgents(rows, "spend"))).toEqual(["a", "b", "c"]);
    expect(names(sortAgents(rows, "tokens"))).toEqual(["c", "b", "a"]);
    expect(names(sortAgents(rows, "requests"))).toEqual(["b", "c", "a"]);
    expect(names(sortAgents(rows, "errors"))).toEqual(["a", "c", "b"]);
    expect(names(sortAgents(rows, "name"))).toEqual(["a", "b", "c"]);
  });

  test("breaks ties by name and does not mutate the input", () => {
    const tied = [agent("z", 1, 0, 0, 0), agent("m", 1, 0, 0, 0)];
    expect(names(sortAgents(tied, "spend"))).toEqual(["m", "z"]);
    expect(names(tied)).toEqual(["z", "m"]);
  });
});

describe("spend and history helpers", () => {
  test("joins model tokens with cost and drops token-less categories", () => {
    const usage = (i: number, o: number) => ({ totalInputTokens: i, totalOutputTokens: o, totalCachedTokens: 0, totalReasoningTokens: 0 });
    const rows = modelTokenRows({ "Chat (a)": usage(10, 10), "Chat (b)": usage(60, 20), "Chat (empty)": usage(0, 0) }, { "Chat (b)": 0.5, "Web Search": 1 });
    expect(rows.map(r => r.category)).toEqual(["Chat (b)", "Chat (a)"]);
    expect(rows[0]!.cost).toBe(0.5);
    expect(rows[0]!.share).toBe(0.8);
    expect(rows[1]!.cost).toBe(0);
  });

  test("sorts history rows by column with an optional flip", () => {
    const row = (displayName: string, totalCost: number, updatedAt: number) => ({
      displayName,
      totalCost,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      requestCount: 0,
      updatedAt,
    });
    const rows = [row("b", 1, 30), row("a", 3, 10), row("c", 2, 20)];
    expect(sortHistory(rows, "updated").map(r => r.displayName)).toEqual(["b", "c", "a"]);
    expect(sortHistory(rows, "spend").map(r => r.displayName)).toEqual(["a", "c", "b"]);
    expect(sortHistory(rows, "spend", true).map(r => r.displayName)).toEqual(["b", "c", "a"]);
    expect(sortHistory(rows, "name").map(r => r.displayName)).toEqual(["a", "b", "c"]);
  });

  test("formats relative times", () => {
    const now = Date.UTC(2026, 9, 12);
    expect(formatRelativeTime(now - 10_000, now)).toBe("just now");
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe("2d ago");
    expect(formatRelativeTime(now - 30 * 86_400_000, now)).toMatch(/2026/);
  });

  test("labels buckets at a precision that suits the range", () => {
    const t = new Date(2026, 9, 12, 14, 5).getTime();
    expect(formatBucketLabel(t, "1h")).toMatch(/2:05/);
    expect(formatBucketLabel(t, "7d")).toMatch(/^Mon 2/);
    expect(formatBucketLabel(t, "30d")).toBe("Oct 12");
  });
});
