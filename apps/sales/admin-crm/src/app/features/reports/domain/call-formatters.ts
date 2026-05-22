export const DASHBOARD_PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'lastweek', label: 'Last Week' },
  { key: 'custom', label: 'Custom' },
];

export const DASHBOARD_PALETTE = {
  incoming: '#4f8fe7',
  outgoing: '#f28c38',
  missed: '#f4c542',
  rejected: '#e46f61',
};

export const CALL_TYPE_OPTIONS = ['Incoming', 'Outgoing', 'Missed', 'Rejected'];
export const DURATION_OPTIONS = ['< 1 min', '1-5 min', '> 5 min'];
export const TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Night'];

export function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  return formatSeconds(seconds);
}

export function formatShortDuration(seconds: number): string {
  if (!seconds) return '0s';
  return formatSeconds(seconds);
}

export function formatAverageDuration(totalDuration: number, connectedCalls: number): string {
  if (!connectedCalls || !totalDuration) return '0s';
  const avg = Math.round(totalDuration / connectedCalls);
  const minutes = Math.floor(avg / 60);
  const seconds = avg % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatSeconds(totalSecs: number): string {
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatIndianDateTime(date: string | undefined | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatIndianTime(timestamp: string | number | undefined): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function dashboardPeriodLabel(period: string): string {
  return DASHBOARD_PERIODS.find((item) => item.key === period)?.label ?? period;
}
