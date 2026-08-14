export type PipelineStageCode =
  | 'QUALIFICATION'
  | 'NEEDS_ANALYSIS'
  | 'VALUE_PROPOSITION'
  | 'PROPOSAL_QUOTE'
  | 'NEGOTIATION_REVIEW'
  | 'CLOSED_WON'
  | 'CLOSED_LOST';
export type ConnectionOutcome = 'NOT_CONNECTED' | 'DNR' | 'BUSY' | 'NOT_REACHABLE';
export type QualificationOutcome = 'QUALIFIED' | 'NOT_QUALIFIED';
export type QualificationReason = 'NOT_INTERESTED' | 'INVALID';
export type LostReason = 'PRICE' | 'WRONG_TIME' | 'COMPETITION';

// No color properties — uses existing CRM design system only
export const PIPELINE_STAGES: Array<{ code: PipelineStageCode; label: string }> = [

  { code: 'QUALIFICATION',      label: 'Qualification'          },
  { code: 'NEEDS_ANALYSIS',     label: 'Needs Analysis'         },
  { code: 'VALUE_PROPOSITION',  label: 'Value Proposition'      },
  { code: 'PROPOSAL_QUOTE',     label: 'Proposal / Price Quote' },
  { code: 'NEGOTIATION_REVIEW', label: 'Negotiation / Review'   },
  { code: 'CLOSED_WON',         label: 'Closed Won'             },
  { code: 'CLOSED_LOST',        label: 'Closed Lost'            },
];

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  PRICE: 'Price',
  WRONG_TIME: 'Wrong Time',
  COMPETITION: 'Competition',
};

export const CONNECTION_OUTCOME_LABELS: Record<ConnectionOutcome, string> = {
  NOT_CONNECTED: 'Not Connected',
  DNR: 'Do Not Reach',
  BUSY: 'Busy',
  NOT_REACHABLE: 'Not Reachable',
};

export const QUALIFICATION_OUTCOME_LABELS: Record<QualificationOutcome, string> = {
  QUALIFIED: 'Qualified',
  NOT_QUALIFIED: 'Not Qualified',
};

export const QUALIFICATION_REASON_LABELS: Record<QualificationReason, string> = {
  NOT_INTERESTED: 'Not Interested',
  INVALID: 'Invalid',
};

export interface PipelineDeal {
  _id: string; // Deal ID
  leadId: string;
  companyCode: string;
  leadCompanyName: string;
  contactName: string;
  contactNumber: string;
  assignedEmployeeId: string;
  dealName: string;
  amount: number;
  closingDate: string | null;
  description: string;
  priority?: string;
  pipelineStage: PipelineStageCode;
  connectionOutcome: string;
  qualificationOutcome: string;
  qualificationReason: string;
  lostReason: string;
  stageChangedAt: string | null;
  status: string;  // existing field — read-only in pipeline context, preserved unchanged
  updatedAt: string;
  createdAt: string;
}

export interface PipelineBoardColumn {
  stage: PipelineStageCode;
  label: string;
  leads: PipelineDeal[];
  total: number;
  totalAmount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PipelineBoardSummary {
  openCount: number;
  openValue: number;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  lostValue: number;
  qualifiedCount: number;
}

export interface PipelineBoardResponse {
  success: boolean;
  columns: PipelineBoardColumn[];
  summary: PipelineBoardSummary;
}

export interface PipelineFilters {
  search: string;
  owner: string;
  connectionOutcome: string;
  qualificationOutcome: string;
  priority?: string;
  dateFilter?: string;
  month?: number;
  year?: number;
}

export interface StageTransitionData {
  qualificationNotes?: string;
  customerNeed?: string;
  painPoint?: string;
  proposedSolution?: string;
  keyBenefits?: string;
  quoteAmount?: number;
  proposalSentDate?: string;
  dealCloseAmount?: number;
  advancePaid?: string;
  negotiationNotes?: string;
  expectedCloseDate?: string;
  finalAmount?: number;
  wonNotes?: string;
  lossNotes?: string;
  competitor?: string;
}

export interface PipelineMovePayload {
  companyCode: string;
  targetStage: PipelineStageCode;
  qualificationOutcome?: QualificationOutcome;
  qualificationReason?: QualificationReason;
  lostReason?: LostReason;
  connectionOutcome?: ConnectionOutcome;
  transitionData?: StageTransitionData;
  isBackward?: boolean;
  backwardReason?: string;
}

export const PIPELINE_STAGE_ORDER: Record<PipelineStageCode, number> = {
  QUALIFICATION: 1,
  NEEDS_ANALYSIS: 2,
  VALUE_PROPOSITION: 3,
  PROPOSAL_QUOTE: 4,
  NEGOTIATION_REVIEW: 5,
  CLOSED_WON: 6,
  CLOSED_LOST: 6 // treat WON/LOST as same order level to prevent forward/backward between them
};

/** Returns how many days a lead has been in its current pipeline stage */
export function daysInStage(stageChangedAt: string | null | undefined): number {
  if (!stageChangedAt) return 0;
  const ms = Date.now() - new Date(stageChangedAt).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function stageLabelFor(code: PipelineStageCode): string {
  return PIPELINE_STAGES.find(s => s.code === code)?.label ?? code;
}
