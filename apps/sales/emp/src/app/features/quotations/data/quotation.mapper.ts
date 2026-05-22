import { QuotationDto } from './quotation.dto';
import { QuotationRecord } from '../domain/quotation.model';

export function mapQuotationDto(dto: QuotationDto): QuotationRecord {
  return {
    id: String(dto._id || ''),
    quotationNumber: String(dto.quotationNumber || ''),
    companyName: String(dto.leadCompanyName || ''),
    contactName: String(dto.contactName || ''),
    contactNumber: String(dto.contactNumber || ''),
    directorEmailAddress: String(dto.directorEmailAddress || ''),
    total: Number(dto.total || 0),
    quotationDate: String(dto.quotationDate || ''),
    createdAt: String(dto.createdAt || ''),
    versionNo: Number(dto.versionNo || 0),
    kindNote: String(dto.kindNote || ''),
    items: Array.isArray(dto.items) ? dto.items : [],
    subtotal: Number(dto.subtotal || 0),
    gstPercentage: Number(dto.gstPercentage || 0),
    gstAmount: Number(dto.gstAmount || 0),
    companySnapshot: dto.companySnapshot,
  };
}
