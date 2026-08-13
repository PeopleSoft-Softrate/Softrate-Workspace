import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminWorkspaceSectionProxy } from '../../../admin-workspace/sections/admin-workspace-section-proxy';

@Component({
  selector: 'app-admin-employee-dashboard-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-employee-dashboard-section.component.html'
})
export class AdminEmployeeDashboardSectionComponent extends AdminWorkspaceSectionProxy {
  
  onTargetYearChange(val: number): void {
    this.vm.targetYear = val;
    // Accessing protected workflow via casting to any
    (this.vm as any).adminEmployeesWorkflow.fetchEmployeeTargets(this.vm);
  }
  
  setEmployeeTarget(month: number, targetAmount: number): void {
    (this.vm as any).adminEmployeesWorkflow.setEmployeeTarget(this.vm, month, targetAmount);
  }
  
  bulkTargetAmount: number | null = null;
  bulkTargetLoading: boolean = false;
  
  applyBulkTarget(): void {
    if (this.bulkTargetAmount === null || this.bulkTargetAmount < 0) return;
    this.bulkTargetLoading = true;
    
    // Optimistically update UI
    if (this.vm.selectedEmpTargets) {
      for (const t of this.vm.selectedEmpTargets) {
        t.targetAmount = this.bulkTargetAmount;
      }
    }
    
    for (let month = 1; month <= 12; month++) {
      (this.vm as any).adminEmployeesWorkflow.setEmployeeTarget(this.vm, month, this.bulkTargetAmount);
    }
    
    setTimeout(() => {
      this.bulkTargetLoading = false;
      this.bulkTargetAmount = null;
    }, 1500);
  }
  
  getMonthName(month: number): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
  }

  get currentRevenueTarget(): number {
    if (!this.vm.selectedEmpTargets || this.vm.selectedEmpTargets.length === 0) return 0;
    
    // For now, if the period is anything other than custom, we just show the current month's target
    const now = new Date();
    let targetMonth = now.getMonth() + 1;
    
    const target = this.vm.selectedEmpTargets.find((t: any) => t.month === targetMonth);
    return target ? (target.targetAmount || 0) : 0;
  }

  get currentAchievedAmount(): number {
    if (!this.vm.selectedEmpTargets || this.vm.selectedEmpTargets.length === 0) return 0;
    
    const now = new Date();
    let targetMonth = now.getMonth() + 1;
    
    const target = this.vm.selectedEmpTargets.find((t: any) => t.month === targetMonth);
    return target ? (target.achievedAmount || 0) : 0;
  }
}
