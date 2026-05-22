import { FollowUpDto } from './follow-up.dto';
import { FollowUp } from '../domain/follow-up.model';

export function mapFollowUpDto(dto: FollowUpDto): FollowUp {
  return {
    id: String(dto._id || ''),
    companyName: String(dto.companyName || ''),
    contactName: String(dto.contactName || ''),
    contactNumber: String(dto.contactNumber || ''),
    employeePhone: String(dto.employeePhone || ''),
    reminderDate: String(dto.reminderDate || ''),
    remarks: dto.remarks || [],
    lastInteraction: String(dto.updatedAt || dto.createdAt || ''),
  };
}
