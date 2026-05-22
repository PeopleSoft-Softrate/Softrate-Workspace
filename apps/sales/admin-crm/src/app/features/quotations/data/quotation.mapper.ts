import { QuotationDto } from './quotation.dto';
import { QuotationRecord } from '../domain/quotation.model';

export function mapQuotationDto(dto: QuotationDto): QuotationRecord {
  return {
    id: String(dto._id || ''),
    quotationNumber: String(dto.quotationNumber || ''),
    companyName: String(dto.leadCompanyName || ''),
    contactName: String(dto.contactName || ''),
    contactNumber: String(dto.contactNumber || ''),
    total: Number(dto.total || 0),
    quotationDate: String(dto.quotationDate || ''),
  };
}
