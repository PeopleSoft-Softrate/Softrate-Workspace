import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { EmployeeService } from '../../../services/employee.service';
import { EmployeeRecord } from '../domain/employee.model';
import { EmployeeDto } from './employee.dto';
import { mapEmployeeDto } from './employee.mapper';

@Injectable({ providedIn: 'root' })
export class EmployeesRepository {
  constructor(private employeeService: EmployeeService) {}

  list(companyCode: string): Observable<EmployeeRecord[]> {
    return this.employeeService.getEmployees(companyCode).pipe(
      map((response) => (response.employees || []).map((dto: EmployeeDto) => mapEmployeeDto(dto)))
    );
  }

  updateTags(employeeId: string, companyCode: string, tags: string[]): Observable<EmployeeRecord> {
    return this.employeeService.updateEmployeeTags(employeeId, tags, companyCode).pipe(
      map((response) => mapEmployeeDto(response.employee || {}))
    );
  }
}
