export interface SettingsSection {
  id: 'company' | 'invoice' | 'quotation' | 'app' | 'admin' | 'tags' | 'lead-statuses' | 'remarks';
  label: string;
  dirty: boolean;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'company', label: 'Company', dirty: false },
  { id: 'invoice', label: 'Invoice', dirty: false },
  { id: 'quotation', label: 'Quotation', dirty: false },
  { id: 'app', label: 'App', dirty: false },
  { id: 'admin', label: 'Admin', dirty: false },
  { id: 'tags', label: 'Tags', dirty: false },
  { id: 'lead-statuses', label: 'Lead Statuses', dirty: false },
  { id: 'remarks', label: 'Remarks', dirty: false },
];
