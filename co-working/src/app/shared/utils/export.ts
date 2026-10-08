/**
 * Client-side export helpers for the mockup. CSV is generated for real;
 * PDF is simulated by opening the browser print dialog on a printable view.
 */
export interface ExportColumn<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
}

export function toCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(c.value(r))).join(',')).join('\n');
  return `${header}\n${body}`;
}

export function downloadCsv<T>(filename: string, rows: T[], columns: ExportColumn<T>[]): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob(['﻿' + toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Mock PDF export: opens the print dialog so the user can "Save as PDF". */
export function printAsPdf(): void {
  if (typeof window !== 'undefined') window.print();
}

export function todayStamp(): string {
  return new Date().toLocaleDateString('en-CA');
}
