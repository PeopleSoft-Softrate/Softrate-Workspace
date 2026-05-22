import { EmployeeDto } from './employee.dto';
import { EmployeeRecord } from '../domain/employee.model';

export function mapEmployeeDto(dto: EmployeeDto): EmployeeRecord {
  return {
    id: String(dto._id || ''),
    name: String(dto.name || ''),
    mobile: String(dto.mobile || ''),
    companyCode: String(dto.companyCode || ''),
    tags: dto.tags || [],
  };
}
