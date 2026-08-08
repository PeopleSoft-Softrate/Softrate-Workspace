import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, DoCheck, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { EmployeeWorkspaceSectionProxy } from '../../../workspace/employee-workspace-section-proxy';
import {
  CONNECTION_OUTCOME_LABELS,
  LOST_REASON_LABELS,
  QUALIFICATION_OUTCOME_LABELS,
  PipelineFilters,
  PipelineLead,
  PipelineStageCode,
  daysInStage,
} from '../../domain/pipeline.model';
import { PipelineSectionViewModel } from '../../state/pipeline-section.viewmodel';

@Component({
  selector: 'app-pipeline-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pipeline-section.component.html',
  styleUrls: ['./pipeline-section.component.css'],
})
export class PipelineSectionComponent extends EmployeeWorkspaceSectionProxy implements OnInit, OnDestroy, DoCheck {
  constructor(public pipelineVm: PipelineSectionViewModel) {
    super();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (this.vm?.dashTab !== 'pipeline') return;
    
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
      event.preventDefault();
      this.pipelineVm.undoLastMove();
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────
  private sub?: Subscription;
  override ngOnInit(): void {
    this.sub = this.pipelineVm.state$.subscribe();
  }

  private lastCompanyCode = '';
  private lastEmployeeId = '';

  ngDoCheck(): void {
    if (this.vm?.dashTab === 'pipeline') {
      const currentCompanyCode = (this.vm as any).employee?.companyCode || '';
      const employeeId = (this.vm as any).employee?._id || '';
      
      if (currentCompanyCode && employeeId) {
        if (currentCompanyCode !== this.lastCompanyCode || employeeId !== this.lastEmployeeId) {
          this.lastCompanyCode = currentCompanyCode;
          this.lastEmployeeId = employeeId;
          this.pipelineVm.init(currentCompanyCode, employeeId);
        }
      }
    }
  }

  override ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ── Filters ────────────────────────────────────────────────────
  pipelineFilters: PipelineFilters = {
    search: '',
    owner: '',
    connectionOutcome: '',
    qualificationOutcome: '',
  };

  private filterDebounce?: ReturnType<typeof setTimeout>;

  onFilterChange(key: keyof PipelineFilters, value: string): void {
    this.pipelineFilters = { ...this.pipelineFilters, [key]: value };
    clearTimeout(this.filterDebounce);
    this.filterDebounce = setTimeout(() => {
      this.pipelineVm.setFilter(this.pipelineFilters);
    }, 300);
  }

  // ── Infinite Scroll ──────────────────────────────────────────────
  onColumnScroll(event: Event, stage: PipelineStageCode, hasMore: boolean): void {
    if (!hasMore) return;
    const target = event.target as HTMLElement;
    
    // Check if scrolled near the bottom (within 50px)
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
      this.pipelineVm.loadMoreColumn(stage);
    }
  }

  // ── Days in Stage ──────────────────────────────────────────────
  daysInStage(stageChangedAt: string | null | undefined): number {
    return daysInStage(stageChangedAt);
  }

  // ── Label helpers ──────────────────────────────────────────────
  connectionOutcomeLabel(code: string): string {
    return (CONNECTION_OUTCOME_LABELS as any)[code] ?? code;
  }

  qualificationOutcomeLabel(code: string): string {
    return (QUALIFICATION_OUTCOME_LABELS as any)[code] ?? code;
  }

  lostReasonLabel(code: string): string {
    return (LOST_REASON_LABELS as any)[code] ?? code;
  }

  trackByLead(index: number, lead: PipelineLead): string {
    return lead._id;
  }

  trackByColumn(index: number, col: any): string {
    return col.stage;
  }

  // ── Drag and Drop ──────────────────────────────────────────────
  draggingLead: PipelineLead | null = null;
  draggingLeadId: string = '';
  dragOverStage: PipelineStageCode | null = null;

  onDragStart(event: DragEvent, lead: PipelineLead): void {
    this.draggingLead = lead;
    this.draggingLeadId = lead._id;
    event.dataTransfer?.setData('text/plain', lead._id);
  }

  onDragEnd(): void {
    this.draggingLeadId = '';
    this.dragOverStage = null;
  }

  onDragOver(event: DragEvent, stage: PipelineStageCode): void {
    event.preventDefault();
    this.dragOverStage = stage;
  }

  onDragLeave(): void {
    this.dragOverStage = null;
  }

  onDrop(event: DragEvent, targetStage: PipelineStageCode): void {
    event.preventDefault();
    this.dragOverStage = null;

    const lead = this.draggingLead;
    this.draggingLead = null;
    this.draggingLeadId = '';

    if (!lead || lead.pipelineStage === targetStage) return;

    const companyCode: string = (this.vm as any).companyCode || (this.vm as any).dashboardCode || '';

    // Qualification stage: require outcome modal when leaving QUALIFICATION
    if (lead.pipelineStage === 'QUALIFICATION' && targetStage === 'NEEDS_ANALYSIS') {
      this.openQualModal(lead, targetStage, companyCode);
      return;
    }

    // Closed Lost: require reason modal
    if (targetStage === 'CLOSED_LOST') {
      this.openLostModal(lead, targetStage, companyCode);
      return;
    }

    // All other moves — proceed directly
    this.pipelineVm.moveStage(lead, { companyCode, targetStage });
  }

  // ── Qualification Modal ────────────────────────────────────────
  showQualModal = false;
  qualModalOutcome: string = '';
  qualModalReason: string = '';
  qualModalError: string = '';
  private qualModalContext: { lead: PipelineLead; targetStage: PipelineStageCode; companyCode: string } | null = null;

  private openQualModal(lead: PipelineLead, targetStage: PipelineStageCode, companyCode: string): void {
    this.qualModalContext = { lead, targetStage, companyCode };
    this.qualModalOutcome = '';
    this.qualModalReason = '';
    this.qualModalError = '';
    this.showQualModal = true;
  }

  cancelQualModal(): void {
    this.showQualModal = false;
    this.qualModalContext = null;
  }

  confirmQualModal(): void {
    this.qualModalError = '';
    if (!this.qualModalOutcome) {
      this.qualModalError = 'Please select an outcome.';
      return;
    }
    if (this.qualModalOutcome === 'NOT_QUALIFIED' && !this.qualModalReason) {
      this.qualModalError = 'Please select a reason for Not Qualified.';
      return;
    }
    if (this.qualModalOutcome === 'NOT_QUALIFIED') {
      // Not qualified: stay on QUALIFICATION stage, just save outcome+reason
      const ctx = this.qualModalContext!;
      this.pipelineVm.moveStage(ctx.lead, {
        companyCode: ctx.companyCode,
        targetStage: 'QUALIFICATION',
        qualificationOutcome: 'NOT_QUALIFIED',
        qualificationReason: this.qualModalReason as any,
      });
      this.showQualModal = false;
      this.qualModalContext = null;
      return;
    }
    // QUALIFIED: proceed to target stage
    const ctx = this.qualModalContext!;
    this.pipelineVm.moveStage(ctx.lead, {
      companyCode: ctx.companyCode,
      targetStage: ctx.targetStage,
      qualificationOutcome: 'QUALIFIED',
    });
    this.showQualModal = false;
    this.qualModalContext = null;
  }

  // ── Closed Lost Modal ──────────────────────────────────────────
  showLostModal = false;
  lostModalReason: string = '';
  lostModalError: string = '';
  private lostModalContext: { lead: PipelineLead; targetStage: PipelineStageCode; companyCode: string } | null = null;

  private openLostModal(lead: PipelineLead, targetStage: PipelineStageCode, companyCode: string): void {
    this.lostModalContext = { lead, targetStage, companyCode };
    this.lostModalReason = '';
    this.lostModalError = '';
    this.showLostModal = true;
  }

  cancelLostModal(): void {
    this.showLostModal = false;
    this.lostModalContext = null;
  }

  confirmLostModal(): void {
    this.lostModalError = '';
    if (!this.lostModalReason) {
      this.lostModalError = 'Please select a lost reason.';
      return;
    }
    const ctx = this.lostModalContext!;
    this.pipelineVm.moveStage(ctx.lead, {
      companyCode: ctx.companyCode,
      targetStage: ctx.targetStage,
      lostReason: this.lostModalReason as any,
    });
    this.showLostModal = false;
    this.lostModalContext = null;
  }
}
