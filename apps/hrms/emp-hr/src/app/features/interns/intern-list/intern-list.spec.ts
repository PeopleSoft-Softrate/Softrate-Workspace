import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InternList } from './intern-list';

describe('InternList', () => {
  let component: InternList;
  let fixture: ComponentFixture<InternList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InternList],
    }).compileComponents();

    fixture = TestBed.createComponent(InternList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
