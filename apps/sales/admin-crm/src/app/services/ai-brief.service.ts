import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface AiBriefSource {
  title: string;
  url: string;
  sourceType: string;
  snippet?: string;
}

export interface AiBriefSourceFinding {
  title: string;
  url: string;
  sourceType: string;
  finding: string;
}

export interface AiBriefRecommendation {
  rank: number;
  serviceName: string;
  tier: 'Basic' | 'Premium' | 'Elite';
  fitReason: string;
  painPointMatch: string;
  pitchAngle: string;
}

export interface AiBrief {
  id: string;
  companyCode: string;
  normalizedCompanyName: string;
  leadCompanyName: string;
  officialWebsite: string;
  industry: string;
  businessSummary: string;
  servicesOrPlatforms: string[];
  sourceFindings: AiBriefSourceFinding[];
  topRecommendations: AiBriefRecommendation[];
  primaryPitch: string;
  discoveryQuestions: string[];
  objectionHints: string[];
  sources: AiBriefSource[];
  model: string;
  researchStatus: 'pending' | 'ready' | 'failed';
  lastGeneratedAt: string | null;
  lastError: string;
}

export interface AiBriefResponse {
  success: boolean;
  cacheStatus?: 'hit' | 'miss';
  researchStatus?: 'pending' | 'ready' | 'failed';
  lastGeneratedAt?: string | null;
  model?: string;
  insight?: AiBrief;
  message?: string;
  retryable?: boolean;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AiBriefService {
  constructor(private api: ApiService) {}

  getLeadBrief(leadId: string): Observable<AiBriefResponse> {
    return this.api.get<AiBriefResponse>(`/api/leads/${leadId}/ai-brief`);
  }
}
