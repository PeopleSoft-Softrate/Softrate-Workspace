import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  PIPELINE_STAGES,
  PipelineBoardColumn,
  PipelineBoardSummary,
  PipelineFilters,
  PipelineDeal,
  PipelineMovePayload,
  PipelineStageCode,
  ConnectionOutcome,
  QualificationOutcome,
  QualificationReason,
  LostReason,
} from '../domain/pipeline.model';
import { PipelineRepository } from '../data/pipeline.repository';

export interface PipelineState {
  columns: PipelineBoardColumn[];
  summary: PipelineBoardSummary;
  loading: boolean;
  error: string;
  moveError: string;
  filters: PipelineFilters;
  undoStack: Array<{ lead: PipelineDeal, originalLead: PipelineDeal, payload: PipelineMovePayload }>;
  loadingColumns: Set<PipelineStageCode>;
}

const initialState: PipelineState = {
  columns: PIPELINE_STAGES.map(s => ({
    stage: s.code,
    label: s.label,
    leads: [],
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: false,
  })),
  summary: { openCount: 0, wonCount: 0, lostCount: 0, qualifiedCount: 0 },
  loading: false,
  error: '',
  moveError: '',
  filters: { search: '', owner: '', connectionOutcome: '', qualificationOutcome: '' },
  undoStack: [],
  loadingColumns: new Set<PipelineStageCode>(),
};

@Injectable({ providedIn: 'root' })
export class PipelineSectionViewModel {
  private readonly stateSubject = new BehaviorSubject<PipelineState>(initialState);
  readonly state$ = this.stateSubject.asObservable();

  private companyCode = '';

  constructor(private repo: PipelineRepository) {}

  get state(): PipelineState {
    return this.stateSubject.value;
  }

  init(companyCode: string, employeeId?: string): void {
    this.companyCode = companyCode;
    if (employeeId) {
      this.patch({ filters: { ...this.state.filters, owner: employeeId } });
    }
    this.loadBoard();
  }

  setFilter(partial: Partial<PipelineFilters>): void {
    this.patch({ filters: { ...this.state.filters, ...partial }, error: '' });
    this.loadBoard();
  }

  loadBoard(): void {
    if (!this.companyCode) return;
    this.patch({ loading: true, error: '' });
    this.repo.getBoard(this.companyCode, this.state.filters).subscribe({
      next: (res) => {
        this.patch({ columns: res.columns, summary: res.summary, loading: false });
      },
      error: () => {
        this.patch({ loading: false, error: 'Failed to load pipeline board. Please try again.' });
      },
    });
  }

  loadMoreColumn(stage: PipelineStageCode): void {
    if (this.state.loadingColumns.has(stage)) return;
    const col = this.state.columns.find(c => c.stage === stage);
    if (!col || !col.hasMore) return;
    const nextPage = col.page + 1;

    const newLoading = new Set(this.state.loadingColumns);
    newLoading.add(stage);
    this.patch({ loadingColumns: newLoading });

    this.repo.loadMoreColumn(this.companyCode, stage, nextPage, this.state.filters, col.pageSize).subscribe({
      next: (res) => {
        const columns = this.state.columns.map(c => {
          if (c.stage !== stage) return c;
          return {
            ...c,
            leads: [...c.leads, ...res.leads],
            page: res.page,
            hasMore: res.hasMore,
            total: res.total,
          };
        });
        const finishedLoading = new Set(this.state.loadingColumns);
        finishedLoading.delete(stage);
        this.patch({ columns, loadingColumns: finishedLoading });
      },
      error: () => {
        const finishedLoading = new Set(this.state.loadingColumns);
        finishedLoading.delete(stage);
        this.patch({ loadingColumns: finishedLoading });
        // Non-fatal — column just doesn't load more; no state corruption
      },
    });
  }

  /**
   * Optimistically moves a card, calls backend, rolls back on failure.
   */
  moveStage(lead: PipelineDeal, payload: PipelineMovePayload, isUndo = false): void {
    const sourceStage = lead.pipelineStage;
    const targetStage = payload.targetStage;

    if (sourceStage === targetStage) return;

    // Optimistic update
    const updatedLead: PipelineDeal = {
      ...lead,
      pipelineStage: targetStage,
      qualificationOutcome: payload.qualificationOutcome ?? lead.qualificationOutcome,
      qualificationReason: payload.qualificationReason ?? lead.qualificationReason,
      lostReason: payload.lostReason ?? lead.lostReason,
      connectionOutcome: payload.connectionOutcome ?? lead.connectionOutcome,
      stageChangedAt: new Date().toISOString(),
    };

    this.applyCardMove(lead, sourceStage, updatedLead, targetStage);
    this.patch({ moveError: '' });

    this.repo.moveStage(lead._id, payload).subscribe({
      next: (res) => {
        // Replace optimistic card with server response
        const serverLead: PipelineDeal = res.lead;
        const columns = this.state.columns.map(c => {
          if (c.stage !== targetStage) return c;
          return {
            ...c,
            leads: c.leads.map(l => l._id === serverLead._id ? serverLead : l),
          };
        });

        // Add to undo stack if this was not an undo operation
        const undoStack = [...this.state.undoStack];
        if (!isUndo) {
          undoStack.push({ lead: serverLead, originalLead: lead, payload });
          if (undoStack.length > 10) undoStack.shift(); // Keep last 10
        }

        this.patch({ columns, undoStack });
      },
      error: (err) => {
        // Rollback: move card back to source stage
        this.applyCardMove(updatedLead, targetStage, lead, sourceStage);
        const message = err?.error?.message || 'Failed to move lead. Please try again.';
        this.patch({ moveError: message });
        // Auto-clear error after 5s
        setTimeout(() => this.patch({ moveError: '' }), 5000);
      },
    });
  }

  undoLastMove(): void {
    if (this.state.undoStack.length === 0) return;

    const undoStack = [...this.state.undoStack];
    const lastAction = undoStack.pop();
    if (!lastAction) return;

    this.patch({ undoStack });

    // The payload needs to put the card back into the state it was in before the move
    const undoPayload: PipelineMovePayload = {
      companyCode: lastAction.payload.companyCode,
      targetStage: lastAction.originalLead.pipelineStage,
      connectionOutcome: (lastAction.originalLead.connectionOutcome as ConnectionOutcome) || undefined,
      qualificationOutcome: (lastAction.originalLead.qualificationOutcome as QualificationOutcome) || undefined,
      qualificationReason: (lastAction.originalLead.qualificationReason as QualificationReason) || undefined,
      lostReason: (lastAction.originalLead.lostReason as LostReason) || undefined,
    };

    // Use lastAction.lead as the current state, and undoPayload to revert it
    this.moveStage(lastAction.lead, undoPayload, true);
  }

  private applyCardMove(
    removeLead: PipelineDeal,
    removeFromStage: PipelineStageCode,
    addLead: PipelineDeal,
    addToStage: PipelineStageCode,
  ): void {
    const columns = this.state.columns.map(c => {
      if (c.stage === removeFromStage) {
        return { ...c, leads: c.leads.filter(l => l._id !== removeLead._id), total: Math.max(0, c.total - 1) };
      }
      if (c.stage === addToStage) {
        return { ...c, leads: [addLead, ...c.leads], total: c.total + 1 };
      }
      return c;
    });
    this.patch({ columns });
  }

  private patch(partial: Partial<PipelineState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
