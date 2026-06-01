import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternLeaves } from './intern-leaves';

describe('InternLeaves', () => {
  let component: InternLeaves;
  let fixture: ComponentFixture<InternLeaves>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InternLeaves],
    }).compileComponents();

    fixture = TestBed.createComponent(InternLeaves);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
