import { InvoiceDto } from './invoice.dto';
import { InvoiceRecord } from '../domain/invoice.model';

export function mapInvoiceDto(dto: InvoiceDto): InvoiceRecord {
  return {
    id: String(dto._id || ''),
    invoiceNumber: String(dto.invoiceNumber || ''),
    publicToken: String(dto.publicToken || ''),
    publicUrl: String(dto.publicUrl || ''),
    companyName: String(dto.leadCompanyName || ''),
    contactName: String(dto.contactName || ''),
    contactNumber: String(dto.contactNumber || ''),
    directorEmailAddress: String(dto.directorEmailAddress || ''),
    employeePhone: String(dto.employeePhone || ''),
    employeeName: String(dto.employeeName || ''),
    total: Number(dto.total || 0),
    invoiceDate: String(dto.invoiceDate || ''),
    createdAt: String(dto.createdAt || ''),
    dueDate: String(dto.dueDate || ''),
    versionNo: Number(dto.versionNo || 0),
    paymentStatus: String(dto.paymentStatus || 'unpaid'),
    items: Array.isArray(dto.items) ? dto.items : [],
    subtotal: Number(dto.subtotal || 0),
    gstPercentage: Number(dto.gstPercentage || 0),
    cgst: Number(dto.cgst || 0),
    sgst: Number(dto.sgst || 0),
    gstAmount: Number(dto.gstAmount || 0),
    companySnapshot: dto.companySnapshot,
    clientSnapshot: dto.clientSnapshot,
  };
}
