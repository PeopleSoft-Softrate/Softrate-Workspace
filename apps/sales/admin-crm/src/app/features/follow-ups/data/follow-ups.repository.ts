import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BookmarkService } from '../../../services/bookmark.service';
import { FollowUp } from '../domain/follow-up.model';
import { FollowUpDto } from './follow-up.dto';
import { mapFollowUpDto } from './follow-up.mapper';

@Injectable({ providedIn: 'root' })
export class FollowUpsRepository {
  constructor(private bookmarkService: BookmarkService) {}

  listForCompany(companyCode: string): Observable<FollowUp[]> {
    return this.bookmarkService.getAllCompanyBookmarks(companyCode).pipe(
      map((response: any) => (response?.bookmarks || []).map((dto: FollowUpDto) => mapFollowUpDto(dto)))
    );
  }
}
