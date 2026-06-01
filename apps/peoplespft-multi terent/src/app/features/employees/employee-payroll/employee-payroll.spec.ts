import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmployeePayroll } from './employee-payroll';

describe('EmployeePayroll', () => {
  let component: EmployeePayroll;
  let fixture: ComponentFixture<EmployeePayroll>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeePayroll],
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeePayroll);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
