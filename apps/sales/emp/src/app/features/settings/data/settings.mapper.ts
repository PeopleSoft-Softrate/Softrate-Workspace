import { SettingsDto } from './settings.dto';

export function mapSettingsDto(dto: SettingsDto): SettingsDto {
  return {
    companyName: String(dto.companyName || ''),
    leadStatuses: dto.leadStatuses || [],
    products: dto.products || [],
  };
}
