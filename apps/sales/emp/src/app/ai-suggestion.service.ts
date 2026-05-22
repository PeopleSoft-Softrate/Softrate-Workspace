import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AiBriefRecommendation } from './ai-brief.service';

export type AiSuggestionScenario = 'followup' | 'interested' | 'not_interested';

export interface AiSuggestion {
  recommendedApproach: string;
  topRecommendations: AiBriefRecommendation[];
  talkingPoints: string[];
  objectionHandling: string[];
  followupMessageDraft: string;
  discoveryQuestions: string[];
  nextStep: string;
  confidenceNote: string;
}

export interface AiSuggestionResponse {
  success: boolean;
  scenario?: AiSuggestionScenario;
  cacheStatus?: 'hit' | 'miss';
  researchStatus?: 'pending' | 'ready' | 'failed';
  model?: string;
  generatedAt?: string;
  suggestion?: AiSuggestion;
  retryable?: boolean;
  failureCategory?: string;
  message?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AiSuggestionService {
  constructor(private api: ApiService) {}

  getLeadSuggestion(
    leadId: string,
    scenario: AiSuggestionScenario,
    bookmarkId?: string
  ): Observable<AiSuggestionResponse> {
    return this.api.post<AiSuggestionResponse>(`/api/leads/${leadId}/ai-suggestion`, {
      scenario,
      bookmarkId,
    });
  }
}
