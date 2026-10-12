import { downloadTextFile } from "@tokenring-ai/one-frontend/lib/transcriptExport.ts";

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | boolean | null | undefined };

/** Quote a cell per RFC 4180 and defuse spreadsheet formula injection. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // A leading =, +, -, @ makes Excel/Sheets evaluate the cell; numbers are safe as-is.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map(c => csvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map(c => csvCell(c.value(row))).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

/** `metrics-agents-2026-10-12.csv` */
export function csvFileName(stem: string, now = new Date()): string {
  return `${stem}-${now.toISOString().slice(0, 10)}.csv`;
}

export function downloadCsv<T>(stem: string, rows: readonly T[], columns: readonly CsvColumn<T>[]): void {
  downloadTextFile(csvFileName(stem), toCsv(rows, columns), "text/csv;charset=utf-8");
}
