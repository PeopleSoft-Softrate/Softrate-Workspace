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
  PipelineDeal,
  PipelineStageCode,
  daysInStage,
  PIPELINE_STAGE_ORDER,
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
    const el = event.target as HTMLElement;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (isAtBottom && hasMore) {
      this.pipelineVm.loadMoreColumn(stage);
    }
  }

  viewCompanyProfile(deal: PipelineDeal): void {
    if (!this.vm) return;
    const vm = this.vm as any;

    let fullLead = vm.allLeads?.find((l: any) => l._id === deal.leadId);
    if (!fullLead) {
      fullLead = {
        _id: deal.leadId,
        leadCompanyName: deal.leadCompanyName,
        contactName: deal.contactName,
        contactNumber: deal.contactNumber,
        companyCode: deal.companyCode,
        assignedEmployeeId: deal.assignedEmployeeId
      };
    }

    if (vm.openCompanyFullViewForLeadContext) {
      vm.openCompanyFullViewForLeadContext(fullLead);
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

  trackByLead(index: number, lead: PipelineDeal): string {
    return lead._id;
  }

  trackByColumn(index: number, col: any): string {
    return col.stage;
  }

  // ── Drag and Drop ──────────────────────────────────────────────
  draggingLead: PipelineDeal | null = null;
  draggingLeadId: string = '';
  dragOverStage: PipelineStageCode | null = null;

  onDragStart(event: DragEvent, lead: PipelineDeal): void {
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

    this.initiateStageMove(lead, targetStage);
  }

  onManualStageChange(lead: PipelineDeal, targetStage: PipelineStageCode): void {
    if (!lead || lead.pipelineStage === targetStage) return;
    this.initiateStageMove(lead, targetStage);
  }

  private initiateStageMove(lead: PipelineDeal, targetStage: PipelineStageCode): void {
    const companyCode: string = lead.companyCode || (this.vm as any).companyCode || (this.vm as any).dashboardCode || '';
    
    // Reset modal form state
    this.resetModalForm();
    
    // Check direction
    const currentOrder = PIPELINE_STAGE_ORDER[lead.pipelineStage] || 0;
    const targetOrder = PIPELINE_STAGE_ORDER[targetStage] || 0;
    this.isBackwardMove = targetOrder < currentOrder;

    this.pipelineVm.requestStageMove(lead, targetStage, companyCode);
  }

  // ── Unified Move to Stage Modal ────────────────────────────────
  isBackwardMove = false;
  modalError = '';
  
  // Backward fields
  backwardReason = '';

  // Standard fields
  qualOutcome = '';
  qualReason = '';
  lostReason = '';
  
  // Transition Data fields
  qualNotes = '';
  customerNeed = '';
  painPoint = '';
  proposedSolution = '';
  keyBenefits = '';
  quoteAmount: number | null = null;
  proposalSentDate = '';
  negotiationNotes = '';
  expectedCloseDate = '';
  dealCloseAmount: number | null = null;
  advancePaid = '';
  finalAmount: number | null = null;
  wonNotes = '';
  lossNotes = '';
  competitor = '';

  resetModalForm(): void {
    this.modalError = '';
    this.backwardReason = '';
    this.qualOutcome = '';
    this.qualReason = '';
    this.lostReason = '';
    this.qualNotes = '';
    this.customerNeed = '';
    this.painPoint = '';
    this.proposedSolution = '';
    this.keyBenefits = '';
    this.quoteAmount = null;
    this.proposalSentDate = '';
    this.negotiationNotes = '';
    this.expectedCloseDate = '';
    this.dealCloseAmount = null;
    this.advancePaid = '';
    this.finalAmount = null;
    this.wonNotes = '';
    this.lossNotes = '';
    this.competitor = '';
  }

  cancelMoveModal(): void {
    this.pipelineVm.cancelStageMove();
  }

  generateProposal(): void {
    const modalState = this.pipelineVm.state.moveModal;
    if (!this.vm || !modalState.lead) return;
    const deal = modalState.lead;

    this.confirmMoveModal();
    if (this.modalError) return;

    // Map deal to full lead for the proposal generator
    let fullLead: any = (this.vm.allLeads || []).find((l: any) => l._id === deal.leadId);
    if (!fullLead) {
      fullLead = {
        _id: deal.leadId,
        leadCompanyName: deal.leadCompanyName,
        contactName: deal.contactName,
        contactNumber: deal.contactNumber,
        companyCode: deal.companyCode,
        assignedEmployeeId: deal.assignedEmployeeId
      };
    }
    
    // Open the proposal modal via the main viewmodel
    if (typeof this.vm.openProposalModal === 'function') {
      this.vm.openProposalModal(fullLead);
    }
  }

  generateQuotation(): void {
    const modalState = this.pipelineVm.state.moveModal;
    if (!this.vm || !modalState.lead) return;
    const deal = modalState.lead;
    
    this.confirmMoveModal();
    if (this.modalError) return;

    let fullLead: any = (this.vm.allLeads || []).find((l: any) => l._id === deal.leadId);
    if (!fullLead) {
      fullLead = {
        _id: deal.leadId,
        leadCompanyName: deal.leadCompanyName,
        contactName: deal.contactName,
        contactNumber: deal.contactNumber,
        companyCode: deal.companyCode,
        assignedEmployeeId: deal.assignedEmployeeId
      };
    }
    
    if (typeof this.vm.openQuotationModal === 'function') {
      this.vm.openQuotationModal(fullLead);
    }
  }

  generateInvoice(): void {
    const modalState = this.pipelineVm.state.moveModal;
    if (!this.vm || !modalState.lead) return;
    const deal = modalState.lead;
    
    this.confirmMoveModal();
    if (this.modalError) return;

    let fullLead: any = (this.vm.allLeads || []).find((l: any) => l._id === deal.leadId);
    if (!fullLead) {
      fullLead = {
        _id: deal.leadId,
        leadCompanyName: deal.leadCompanyName,
        contactName: deal.contactName,
        contactNumber: deal.contactNumber,
        companyCode: deal.companyCode,
        assignedEmployeeId: deal.assignedEmployeeId
      };
    }
    
    if (typeof (this.vm as any).openInvoiceModal === 'function') {
      (this.vm as any).openInvoiceModal(fullLead);
    } else if (typeof (this.vm as any).openAdminInvoiceModal === 'function') {
      (this.vm as any).openAdminInvoiceModal(fullLead);
    }
  }

  viewLead(lead: PipelineDeal): void {
    if (this.vm?.openCompanyFullViewForLeadContext) {
      this.vm.openCompanyFullViewForLeadContext(lead);
    }
  }

  confirmMoveModal(): void {
    this.modalError = '';
    const state = this.pipelineVm.state.moveModal;
    if (!state.open || !state.lead || !state.targetStage) return;

    const targetStage = state.targetStage;

    if (this.isBackwardMove) {
      if (!this.backwardReason.trim()) {
        this.modalError = 'Please provide a reason for moving backward.';
        return;
      }
    } else {
      // Forward validation based on target stage
      if (targetStage === 'NEEDS_ANALYSIS' && state.lead.pipelineStage === 'QUALIFICATION') {
        if (!this.qualOutcome) {
          this.modalError = 'Please select a qualification outcome.';
          return;
        }
        if (this.qualOutcome === 'NOT_QUALIFIED' && !this.qualReason) {
          this.modalError = 'Please select a reason for Not Qualified.';
          return;
        }
      }

      if (targetStage === 'CLOSED_LOST' && !this.lostReason) {
        this.modalError = 'Please select a lost reason.';
        return;
      }
      
      if (targetStage === 'PROPOSAL_QUOTE') {
        if (!this.quoteAmount || !this.proposalSentDate) {
          this.modalError = 'Please enter Quote Amount and Proposal Sent Date.';
          return;
        }
      }
    }

    if (this.qualOutcome === 'NOT_QUALIFIED') {
      // If moving to Needs Analysis but they select NOT_QUALIFIED, we actually keep them in QUALIFICATION
      // and just update the reason.
      this.pipelineVm.confirmStageMove({
        companyCode: state.companyCode,
        targetStage: 'QUALIFICATION',
        qualificationOutcome: 'NOT_QUALIFIED',
        qualificationReason: this.qualReason as any,
        transitionData: { qualificationNotes: this.qualNotes }
      });
      return;
    }

    this.pipelineVm.confirmStageMove({
      companyCode: state.companyCode,
      targetStage,
      isBackward: this.isBackwardMove,
      backwardReason: this.backwardReason,
      qualificationOutcome: this.qualOutcome ? (this.qualOutcome as any) : undefined,
      lostReason: this.lostReason ? (this.lostReason as any) : undefined,
      transitionData: {
        qualificationNotes: this.qualNotes,
        customerNeed: this.customerNeed,
        painPoint: this.painPoint,
        proposedSolution: this.proposedSolution,
        keyBenefits: this.keyBenefits,
        quoteAmount: this.quoteAmount || undefined,
        proposalSentDate: this.proposalSentDate,
        dealCloseAmount: this.dealCloseAmount || undefined,
        advancePaid: this.advancePaid || undefined,
        negotiationNotes: this.negotiationNotes,
        expectedCloseDate: this.expectedCloseDate,
        finalAmount: this.finalAmount || undefined,
        wonNotes: this.wonNotes,
        lossNotes: this.lossNotes,
        competitor: this.competitor
      }
    });
  }
}
