import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { EmployeeRecord } from '../domain/employee.model';

export interface EmployeesState {
  employee: EmployeeRecord | null;
  loading: boolean;
  error: string;
}

@Injectable({ providedIn: 'root' })
export class EmployeesViewModel {
  private readonly stateSubject = new BehaviorSubject<EmployeesState>({
    employee: null,
    loading: false,
    error: '',
  });

  readonly state$ = this.stateSubject.asObservable();
}
