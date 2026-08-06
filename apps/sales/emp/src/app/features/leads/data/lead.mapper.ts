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
    assignedEmployeeId: String(dto.assignedEmployeeId || ''),
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
    sheetOrder: dto.sheetOrder,
    createdAt: String(dto.createdAt || ''),
    updatedAt: String(dto.updatedAt || ''),
    dateOfIncorporation: dto.dateOfIncorporation !== undefined ? String(dto.dateOfIncorporation) : undefined,
    companyEmail: dto.companyEmail !== undefined ? String(dto.companyEmail) : undefined,
    authorisedCapital: dto.authorisedCapital !== undefined ? String(dto.authorisedCapital) : undefined,
    paidUpCapital: dto.paidUpCapital !== undefined ? String(dto.paidUpCapital) : undefined,
    companyType: dto.companyType !== undefined ? String(dto.companyType) : undefined,
    classOfCompany: dto.classOfCompany !== undefined ? String(dto.classOfCompany) : undefined,
    companyOrigin: dto.companyOrigin !== undefined ? String(dto.companyOrigin) : undefined,
    roc: dto.roc !== undefined ? String(dto.roc) : undefined,
    directorFirstName: dto.directorFirstName !== undefined ? String(dto.directorFirstName) : undefined,
    directorLastName: dto.directorLastName !== undefined ? String(dto.directorLastName) : undefined,
    directorMobileNumber: dto.directorMobileNumber !== undefined ? String(dto.directorMobileNumber) : undefined,
    directorEmailAddress: dto.directorEmailAddress !== undefined ? String(dto.directorEmailAddress) : undefined,
    cin: dto.cin !== undefined ? String(dto.cin) : undefined,
    totalObligationOfContribution: dto.totalObligationOfContribution !== undefined ? String(dto.totalObligationOfContribution) : undefined,
    addressType: dto.addressType !== undefined ? String(dto.addressType) : undefined,
    streetAddressLine1: dto.streetAddressLine1 !== undefined ? String(dto.streetAddressLine1) : undefined,
    streetAddressLine2: dto.streetAddressLine2 !== undefined ? String(dto.streetAddressLine2) : undefined,
    city: dto.city !== undefined ? String(dto.city) : undefined,
    state: dto.state !== undefined ? String(dto.state) : undefined,
    postalCode: dto.postalCode !== undefined ? String(dto.postalCode) : undefined,
    mainDivisionNo: dto.mainDivisionNo !== undefined ? String(dto.mainDivisionNo) : undefined,
    companyCategory: dto.companyCategory !== undefined ? String(dto.companyCategory) : undefined,
    companySubcategory: dto.companySubcategory !== undefined ? String(dto.companySubcategory) : undefined,
    registrationNumber: dto.registrationNumber !== undefined ? String(dto.registrationNumber) : undefined,
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
    divisions: dto.divisions || [],
    companies: dto.companies || [],
  };
}
