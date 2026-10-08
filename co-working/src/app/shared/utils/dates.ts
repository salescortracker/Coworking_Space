/** Local-time date helpers (avoid UTC shifts from toISOString in IST evenings). */
export function isoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayIso(): string {
  return isoDate(new Date());
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso + 'T12:00:00').getTime() - new Date(fromIso + 'T12:00:00').getTime()) / 86400000);
}

export function startOfWeek(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const day = (d.getDay() + 6) % 7; // Monday first
  d.setDate(d.getDate() - day);
  return isoDate(d);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
}
