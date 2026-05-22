import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternReview } from './intern-review';

describe('InternReview', () => {
  let component: InternReview;
  let fixture: ComponentFixture<InternReview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InternReview],
    }).compileComponents();

    fixture = TestBed.createComponent(InternReview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
