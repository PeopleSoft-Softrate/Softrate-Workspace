import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternDetails } from './intern-details';

describe('InternDetails', () => {
  let component: InternDetails;
  let fixture: ComponentFixture<InternDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InternDetails],
    }).compileComponents();

    fixture = TestBed.createComponent(InternDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
