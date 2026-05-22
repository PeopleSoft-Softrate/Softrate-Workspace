import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternAttendance } from './intern-attendance';

describe('InternAttendance', () => {
  let component: InternAttendance;
  let fixture: ComponentFixture<InternAttendance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InternAttendance],
    }).compileComponents();

    fixture = TestBed.createComponent(InternAttendance);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
