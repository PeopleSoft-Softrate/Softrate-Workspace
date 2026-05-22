import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SETTINGS_SECTIONS, SettingsSection } from '../domain/settings.model';
import { SettingsDto } from '../data/settings.dto';
import { SettingsRepository } from '../data/settings.repository';

export interface SettingsState {
  sections: SettingsSection[];
  activeSectionId: string;
  loading: boolean;
  saving: boolean;
  error: string;
  settings: SettingsDto | null;
}

@Injectable({ providedIn: 'root' })
export class SettingsViewModel {
  private readonly stateSubject = new BehaviorSubject<SettingsState>({
    sections: SETTINGS_SECTIONS,
    activeSectionId: 'company',
    loading: false,
    saving: false,
    error: '',
    settings: null,
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor(private repository: SettingsRepository) {}

  selectSection(activeSectionId: SettingsState['activeSectionId']): void {
    this.patch({ activeSectionId });
  }

  load(companyCode: string): void {
    this.patch({ loading: true, error: '' });
    this.repository.load(companyCode).subscribe({
      next: (settings) => this.patch({ settings, loading: false }),
      error: () => this.patch({ loading: false, error: 'Failed to load settings.' }),
    });
  }

  save(companyCode: string, settings: SettingsDto, sectionId: SettingsSection['id']): void {
    this.patch({ saving: true, error: '' });
    this.repository.save(companyCode, settings).subscribe({
      next: (saved) => this.patch({
        settings: saved,
        saving: false,
        sections: this.stateSubject.value.sections.map((section) =>
          section.id === sectionId ? { ...section, dirty: false } : section
        ),
      }),
      error: () => this.patch({ saving: false, error: 'Failed to save settings.' }),
    });
  }

  markDirty(sectionId: SettingsSection['id']): void {
    this.patch({
      sections: this.stateSubject.value.sections.map((section) =>
        section.id === sectionId ? { ...section, dirty: true } : section
      ),
    });
  }

  private patch(partial: Partial<SettingsState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
