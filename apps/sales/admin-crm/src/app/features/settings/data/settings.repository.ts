import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { SettingsDto } from './settings.dto';
import { mapSettingsDto } from './settings.mapper';

@Injectable({ providedIn: 'root' })
export class SettingsRepository {
  constructor(private authService: AuthService) {}

  load(companyCode: string): Observable<SettingsDto> {
    return this.authService.getCompanySettings(companyCode).pipe(
      map((response) => mapSettingsDto(response?.settings || {}))
    );
  }

  save(companyCode: string, settings: SettingsDto): Observable<SettingsDto> {
    return this.authService.updateCompanySettings(companyCode, settings).pipe(
      map((response) => mapSettingsDto(response?.settings || settings))
    );
  }
}
