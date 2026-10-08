import { Pipe, PipeTransform } from '@angular/core';

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const INR2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUM = new Intl.NumberFormat('en-IN');

export function formatInr(value: number | null | undefined, decimals = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return (decimals ? INR2 : INR).format(value);
}

export function compactInr(value: number): string {
  if (Math.abs(value) >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (Math.abs(value) >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
  if (Math.abs(value) >= 1e3) return `₹${(value / 1e3).toFixed(1)}k`;
  return formatInr(value);
}

/** Converts SNAKE_CASE enum values into readable labels: IN_PROGRESS → In Progress */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const future = diff < 0;
  const s = Math.abs(diff) / 1000;
  const fmt = (n: number, unit: string) => {
    const v = Math.floor(n);
    return future ? `in ${v} ${unit}${v === 1 ? '' : 's'}` : `${v} ${unit}${v === 1 ? '' : 's'} ago`;
  };
  if (s < 60) return future ? 'in a moment' : 'just now';
  if (s < 3600) return fmt(s / 60, 'min');
  if (s < 86400) return fmt(s / 3600, 'hour');
  if (s < 86400 * 30) return fmt(s / 86400, 'day');
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = false): string {
    return formatInr(value, decimals);
  }
}

@Pipe({ name: 'compactInr' })
export class CompactInrPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : compactInr(value);
  }
}

@Pipe({ name: 'num' })
export class NumPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : NUM.format(value);
  }
}

@Pipe({ name: 'humanize' })
export class HumanizePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return humanize(value);
  }
}

@Pipe({ name: 'ago', pure: false })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return relativeTime(value);
  }
}

/** Formats a 24h "HH:mm" string as "h:mm AM". */
@Pipe({ name: 'time12' })
export class Time12Pipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';
    const [h, m] = value.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 || 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
  }
}

/** Masks all but the last 4 digits of a mobile number. */
@Pipe({ name: 'mobile' })
export class MobilePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';
    const d = value.replace(/\D/g, '').slice(-10);
    return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : value;
  }
}

export const FORMAT_PIPES = [InrPipe, CompactInrPipe, NumPipe, HumanizePipe, RelativeTimePipe, Time12Pipe, MobilePipe] as const;
