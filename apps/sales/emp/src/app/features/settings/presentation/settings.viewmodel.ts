import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SettingsSection } from '../domain/settings.model';

export interface SettingsState {
  sections: SettingsSection[];
  activeSectionId: string;
  loading: boolean;
  saving: boolean;
  error: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsViewModel {
  private readonly stateSubject = new BehaviorSubject<SettingsState>({
    sections: [],
    activeSectionId: 'company',
    loading: false,
    saving: false,
    error: '',
  });

  readonly state$ = this.stateSubject.asObservable();
}
