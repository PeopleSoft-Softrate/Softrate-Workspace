import { InvoiceDto } from './invoice.dto';
import { InvoiceRecord } from '../domain/invoice.model';

export function mapInvoiceDto(dto: InvoiceDto): InvoiceRecord {
  return {
    id: String(dto._id || ''),
    invoiceNumber: String(dto.invoiceNumber || ''),
    companyName: String(dto.leadCompanyName || ''),
    contactName: String(dto.contactName || ''),
    contactNumber: String(dto.contactNumber || ''),
    total: Number(dto.total || 0),
    invoiceDate: String(dto.invoiceDate || ''),
  };
}
