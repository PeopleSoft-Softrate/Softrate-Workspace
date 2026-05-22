export interface SettingsDto {
  companyName?: string;
  leadStatuses?: string[];
  products?: Array<{ name: string; minPrice: number; maxPrice: number }>;
}
