import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import {
  PipelineBoardResponse,
  PipelineFilters,
  PipelineMovePayload,
  PipelineStageCode,
} from '../domain/pipeline.model';

@Injectable({ providedIn: 'root' })
export class PipelineRepository {
  constructor(private api: ApiService) {}

  private qs(params: Record<string, string | number | boolean | undefined>): string {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
    });
    const s = p.toString();
    return s ? `?${s}` : '';
  }

  getBoard(companyCode: string, filters: Partial<PipelineFilters> = {}, pageSize = 25): Observable<PipelineBoardResponse> {
    const url = `/api/pipeline/board${this.qs({ companyCode, pageSize, ...filters })}`;
    return this.api.get<PipelineBoardResponse>(url);
  }

  loadMoreColumn(
    companyCode: string,
    stage: PipelineStageCode,
    page: number,
    filters: Partial<PipelineFilters> = {},
    pageSize = 25,
  ): Observable<any> {
    const url = `/api/pipeline/board/column${this.qs({ companyCode, stage, page, pageSize, ...filters })}`;
    return this.api.get<any>(url);
  }

  moveStage(leadId: string, payload: PipelineMovePayload): Observable<any> {
    return this.api.patch<any>(`/api/pipeline/leads/${leadId}/stage`, payload);
  }
}
