import { ReportRowDto } from './report.dto';
import { ReportRow } from '../domain/report.model';

export function mapReportRowDto(dto: ReportRowDto): ReportRow {
  return {
    id: String(dto.id || dto.label || ''),
    label: String(dto.label || ''),
    value: Number(dto.value || 0),
    period: String(dto.period || ''),
  };
}
