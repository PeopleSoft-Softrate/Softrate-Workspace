import { LeadDto, LeadListDto } from './lead.dto';
import { Lead } from '../domain/lead.model';

export function mapLeadDto(dto: LeadDto): Lead {
  const remarks = Array.isArray(dto.remarks)
    ? dto.remarks
    : String(dto.remarks || '')
      .split('\n')
      .map((remark) => remark.trim())
      .filter(Boolean);

  return {
    id: String(dto._id || ''),
    companyCode: String(dto.companyCode || ''),
    assignedEmployeePhone: String(dto.assignedEmployeePhone || ''),
    companyName: String(dto.leadCompanyName || ''),
    contactName: String(dto.contactName || ''),
    contactNumber: String(dto.contactNumber || ''),
    status: String(dto.status || 'New'),
    setLabel: String(dto.setLabel || ''),
    description: String(dto.companyDescription || ''),
    division: String(dto.mainDivisionDescription || ''),
    email: String(dto.directorEmailAddress || ''),
    remarks,
    isStarred: !!dto.isStarred,
    isFavourite: !!dto.isFavourite,
    createdAt: String(dto.createdAt || ''),
    updatedAt: String(dto.updatedAt || ''),
  };
}

export function mapLeadListDto(dto: LeadListDto) {
  const rawItems = dto.items || dto.leads || [];

  return {
    items: rawItems.map(mapLeadDto),
    page: Number(dto.page || 1),
    pageSize: Number(dto.pageSize || rawItems.length || 20),
    total: Number(dto.total || rawItems.length || 0),
    hasMore: !!dto.hasMore,
    sets: dto.sets || [],
    companies: dto.companies || [],
  };
}
