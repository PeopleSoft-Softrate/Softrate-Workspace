export const ADMIN_LEAD_STATUSES = [
  'New',
  'Contacted',
  'Converted',
  'Follow Up',
  'Details Shared',
  'Future Needs',
  'Call Later',
  'Not Interested',
  'DNP / Not Reachable',
  'Busy',
  'Switch off',
  'Invalid'
];

export function leadStatusClass(status: string): string {
  if (!status) return 'status-new';
  const normalized = status.toLowerCase();
  if (normalized.includes('interested') || normalized.includes('follow') || normalized.includes('later')) return 'status-interested';
  if (normalized.includes('not') || normalized.includes('busy') || normalized.includes('switch off') || normalized.includes('invalid') || normalized.includes('dnp')) return 'status-not-interested';
  if (normalized.includes('convert')) return 'status-converted';
  if (normalized.includes('contact') || normalized.includes('shared') || normalized.includes('need')) return 'status-contacted';
  return 'status-new';
}

export function leadStatusShortLabel(status: string): string {
  const normalized = String(status || '').trim();
  const lower = normalized.toLowerCase();
  if (!normalized) return 'New';
  if (lower.includes('follow')) return 'Follow-up';
  if (lower.includes('not interested')) return 'Not Interested';
  if (lower.includes('not') || lower.includes('dnp') || lower.includes('busy') || lower.includes('switch off') || lower.includes('invalid')) return 'Not Connected';
  if (lower.includes('convert')) return 'Converted';
  if (lower.includes('interest')) return 'Interested';
  return normalized;
}

export function leadStatusColor(status: string): string {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('interested')) return 'var(--status-positive, #16a34a)';
  if (normalized.includes('not') || normalized.includes('busy') || normalized.includes('switch off') || normalized.includes('invalid') || normalized.includes('dnp')) return 'var(--status-negative, #dc2626)';
  if (normalized.includes('convert')) return 'var(--status-info, #2563eb)';
  if (normalized.includes('follow') || normalized.includes('quotation') || normalized.includes('later')) return 'var(--status-warning, #d97706)';
  if (normalized.includes('contact') || normalized.includes('meeting') || normalized.includes('shared') || normalized.includes('need')) return 'var(--status-info, #2563eb)';
  return 'var(--admin-ink, #111827)';
}

export function normalizedLeadStatus(status: string | null | undefined): string {
  const value = String(status || '').trim();
  return ADMIN_LEAD_STATUSES.includes(value) ? value : 'New';
}
