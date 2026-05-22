import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { OPERATIONAL_PAGE_SIZE } from '../../../core/config/pagination.config';
import { EmployeeRecord } from '../domain/employee.model';
import { EmployeesRepository } from '../data/employees.repository';

export interface EmployeesState {
  employees: EmployeeRecord[];
  selectedEmployeeId: string;
  search: string;
  pageSize: number;
  loading: boolean;
  error: string;
}

@Injectable({ providedIn: 'root' })
export class EmployeesViewModel {
  private readonly stateSubject = new BehaviorSubject<EmployeesState>({
    employees: [],
    selectedEmployeeId: '',
    search: '',
    pageSize: OPERATIONAL_PAGE_SIZE,
    loading: false,
    error: '',
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor(private repository: EmployeesRepository) {}

  load(companyCode: string): void {
    this.patch({ loading: true, error: '' });
    this.repository.list(companyCode).subscribe({
      next: (employees) => this.patch({ employees, loading: false }),
      error: () => this.patch({ loading: false, error: 'Failed to load employees.' }),
    });
  }

  updateTags(employeeId: string, companyCode: string, tags: string[]): void {
    this.repository.updateTags(employeeId, companyCode, tags).subscribe({
      next: (updated) => {
        const employees = this.stateSubject.value.employees.map((employee) =>
          employee.id === updated.id ? updated : employee
        );
        this.patch({ employees });
      },
      error: () => this.patch({ error: 'Failed to update employee tags.' }),
    });
  }

  private patch(partial: Partial<EmployeesState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
