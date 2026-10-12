import { describe, expect, it } from "bun:test";
import { csvCell, csvFileName, toCsv } from "./csv.ts";

describe("csv", () => {
  it("quotes cells containing separators, quotes or newlines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(0.25)).toBe("0.25");
  });

  it("defuses spreadsheet formulas in text cells but not negative numbers", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell(-3)).toBe("-3");
  });

  it("builds a CRLF document with a header row", () => {
    const csv = toCsv(
      [
        { a: "x", b: 1 },
        { a: "y,z", b: 2 },
      ],
      [
        { header: "A", value: r => r.a },
        { header: "B", value: r => r.b },
      ],
    );
    expect(csv).toBe('A,B\r\nx,1\r\n"y,z",2\r\n');
  });

  it("dates file names", () => {
    expect(csvFileName("metrics-agents", new Date(Date.UTC(2026, 9, 12, 12)))).toBe("metrics-agents-2026-10-12.csv");
  });
});
