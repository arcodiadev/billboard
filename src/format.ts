// Time formatting helpers used across the views.

/** "12:34" for under an hour, "1:02:34" past an hour. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, '0');
  if (m < 60) return `${m}:${sec}`;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${sec}`;
}

/** "26 min", "3 h 12 min", "<1 min". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  if (m < 1) return '<1 min';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** "08:12" local time. */
export function formatTimeHM(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** "08:12:34" local time. */
export function formatTimeHMS(date: Date): string {
  return `${formatTimeHM(date)}:${String(date.getSeconds()).padStart(2, '0')}`;
}

export function secondsBetween(iso: string, now: number): number {
  return Math.max(0, (now - Date.parse(iso)) / 1000);
}
