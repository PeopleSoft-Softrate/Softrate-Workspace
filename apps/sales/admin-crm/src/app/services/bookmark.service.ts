import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Bookmark {
  _id?: string;
  companyCode: string;
  employeePhone: string;
  contactNumber: string;
  contactName: string;
  description?: string;
  remarks: string[];
  brochuresSent?: boolean;
  techMeet?: boolean;
  meetingRemarks?: boolean;
  quotationSent?: boolean;
  proposalSent?: boolean;
  whatsappGrp?: boolean;
  callTimestamp?: number;
  reminderDate: string | null;
  companyName?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BookmarkService {
  private baseUrl: string;

  constructor(private http: HttpClient, private apiService: ApiService) {
    this.baseUrl = this.apiService.baseUrl + '/api/bookmarks';
  }

  private buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      search.set(key, String(value));
    });
    const query = search.toString();
    return query ? `?${query}` : '';
  }

  getBookmarks(companyCode: string, phone: string): Observable<any> {
    return this.http.get(`${this.baseUrl}?companyCode=${companyCode}&phone=${phone}`);
  }

  getEmployeeBookmarkPage(
    companyCode: string,
    phone: string,
    query: {
      page?: number;
      pageSize?: number;
      paginated?: boolean;
      search?: string;
      filter?: string;
      reminderDate?: string;
      dateFrom?: string;
      dateTo?: string;
      hasReminder?: boolean;
      companyName?: string;
      sort?: string;
    } = {}
  ): Observable<any> {
    return this.http.get(`${this.baseUrl}${this.buildQueryString({
      companyCode,
      phone,
      ...query,
    })}`);
  }

  // Admin view: fetch all bookmarks for the whole company
  getAllCompanyBookmarks(
    companyCode: string,
    query: {
      page?: number;
      pageSize?: number;
      paginated?: boolean;
      search?: string;
      filter?: string;
      reminderDate?: string;
    } = {}
  ): Observable<any> {
    const params = new URLSearchParams({ companyCode });
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params.set(key, String(value));
    });
    return this.http.get(`${this.baseUrl}/admin?${params.toString()}`);
  }

  deleteBookmark(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  updateBookmark(id: string, payload: { description?: string, reminderDate?: string | null }): Observable<any> {
    return this.http.patch(`${this.baseUrl}/${id}`, payload);
  }

  addBulkBookmarks(bookmarks: Partial<Bookmark>[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/bulk`, { bookmarks });
  }
}
