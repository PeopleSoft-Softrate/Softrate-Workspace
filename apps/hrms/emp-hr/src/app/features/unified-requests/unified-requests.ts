import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { SocketService } from '../../services/socket.service';
import { forkJoin, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { 
  UserGroupIcon, 
  Clock01Icon, 
  Calendar01Icon, 
  WorkflowSquare03Icon,
  FilterIcon,
  Search01Icon,
  BorderFullIcon,
  Logout01Icon,
  Login01Icon,
  FingerAccessIcon
} from '@hugeicons/core-free-icons';

@Component({
  selector: 'app-unified-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HugeiconsIconComponent],
  templateUrl: './unified-requests.html',
  styleUrl: './unified-requests.css'
})
export class UnifiedRequests implements OnInit, OnDestroy {
  private apiService = inject(ApiService);
  private socketService = inject(SocketService);

  // Icons
  readonly UserGroupIcon = UserGroupIcon;
  readonly Clock01Icon = Clock01Icon;
  readonly Calendar01Icon = Calendar01Icon;
  readonly WorkflowSquare03Icon = WorkflowSquare03Icon;
  readonly FilterIcon = FilterIcon;
  readonly Search01Icon = Search01Icon;
  readonly BorderFullIcon = BorderFullIcon;
  readonly Logout01Icon = Logout01Icon;
  readonly Login01Icon = Login01Icon;
  readonly FingerAccessIcon = FingerAccessIcon;

  // Role and Profile Info
  userRole = signal<string | null>(null);
  userData = signal<any>(null);
  isHr = computed(() => this.userRole() === 'hr' || this.userRole() === 'hr_admin');
  isManager = computed(() => this.userRole() === 'manager');

  // Unified Request List State
  requestsList = signal<any[]>([]);
  loading = signal<boolean>(false);
  activeCategory = signal<string>('all'); // 'all', 'leave', 'offboarding', 'onboarding'
  activeStatus = signal<string>('pending'); // 'pending', 'approved', 'rejected'
  searchQuery = signal<string>('');

  // Sockets Subscription
  private socketSub?: Subscription;

  // Modal Action States
  showReviewModal = signal<boolean>(false);
  reviewAction = signal<'approve' | 'reject' | null>(null);
  selectedRequest = signal<any | null>(null);
  reviewRemarks = signal<string>('');

  // Special Offboarding flags for HR approval
  certInternship = signal<boolean>(false);
  certProject = signal<boolean>(false);
  certLor = signal<boolean>(false);

  // Onboarding Form Details (For HR Approval Action)
  onboardingDate = signal<string>('');
  endDate = signal<string>('');
  internshipType = signal<string>('Stipend'); // Stipend / Paid
  assignedRole = signal<string>('');

  ngOnInit() {
    this.userRole.set(localStorage.getItem('user_role'));
    const storedUserData = localStorage.getItem('user_data');
    if (storedUserData) {
      this.userData.set(JSON.parse(storedUserData));
    }

    this.fetchRequests();

    // Subscribe to Socket.io events for live dashboard updates
    this.socketSub = this.socketService.on('activity-updated').subscribe({
      next: (event) => {
        console.log('Realtime socket update received:', event);
        this.fetchRequests(true); // Silent background refresh
      },
      error: (err) => console.error('Socket connection error:', err)
    });
  }

  ngOnDestroy() {
    if (this.socketSub) {
      this.socketSub.unsubscribe();
    }
  }

  fetchRequests(silent: boolean = false) {
    if (!silent) this.loading.set(true);

    const role = this.userRole();
    const managerId = this.userData()?._id;

    if (!role) {
      this.loading.set(false);
      return;
    }

    if (this.isHr()) {
      // HR: Fetch everything company-wide
      forkJoin({
        leaves: this.apiService.getHRPendingLeaves(),
        resignations: this.apiService.getHRPendingResignations(),
        interns: this.apiService.getPendingInterns(),
        employees: this.apiService.getPendingEmployees(),
        corrections: this.apiService.getHrPendingAttendanceRequests()
      }).pipe(
        finalize(() => this.loading.set(false))
      ).subscribe({
        next: (res) => {
          console.group('🔍 [UnifiedRequests] HR Raw API Data');
          console.log('Leaves:', res.leaves);
          console.log('Resignations:', res.resignations);
          console.log('Interns:', res.interns);
          console.log('Employees:', res.employees);
          console.log('Corrections:', res.corrections);
          console.groupEnd();
          this.consolidateHRData(res.leaves, res.resignations, res.interns, res.employees, res.corrections || []);
          console.group('🔍 [UnifiedRequests] After Consolidation');
          console.log('Total requestsList:', this.requestsList().length);
          console.log('All items managerStatus:', this.requestsList().map(r => ({ name: r.requesterName, type: r.type, status: r.status, managerStatus: r.managerStatus })));
          console.groupEnd();
        },
        error: (err) => {
          console.error('Failed to fetch HR approvals data:', err);
          alert('Failed to load approvals data. Please refresh.');
        }
      });
    } else if (this.isManager() && managerId) {
      // Manager: Fetch team-only pending data
      forkJoin({
        leaves: this.apiService.getManagerAllLeaves(managerId),
        resignations: this.apiService.getAllResignations(), // Manager resignations filtered by team
        interns: this.apiService.getAssignedInterns(managerId),
        employees: this.apiService.getAssignedEmployees(managerId),
        corrections: this.apiService.getManagerPendingAttendanceRequests(managerId)
      }).pipe(
        finalize(() => this.loading.set(false))
      ).subscribe({
        next: (res) => {
          this.consolidateManagerData(managerId, res.leaves, res.resignations.data || res.resignations || [], res.interns, res.employees, res.corrections || []);
        },
        error: (err) => {
          console.error('Failed to fetch Manager approvals data:', err);
          alert('Failed to load approvals data. Please refresh.');
        }
      });
    } else {
      this.loading.set(false);
    }
  }

  consolidateHRData(leaves: any[], resignationsRes: any, interns: any[], employees: any[], corrections: any[]) {
    const list: any[] = [];
    const resignations = resignationsRes?.data || resignationsRes || [];

    // 1. Leave Requests
    leaves.forEach(l => {
      list.push({
        _id: l._id,
        requesterName: l.employeeName,
        requesterId: l.employeeId,
        type: 'leave',
        subType: l.leaveType,
        dateText: `${new Date(l.fromDate).toLocaleDateString('en-IN')} - ${new Date(l.toDate).toLocaleDateString('en-IN')}`,
        days: l.numberOfDays,
        reason: l.reason,
        status: l.hrStatus, // Primary status for HR is hrStatus
        managerStatus: l.managerStatus,
        hrStatus: l.hrStatus,
        rejectionReason: l.rejectionReason,
        createdAt: l.createdAt,
        raw: l
      });
    });

    // 2. Offboarding / Resignations
    resignations.forEach((r: any) => {
      list.push({
        _id: r._id,
        requesterName: r.fullName,
        requesterId: r.internId || 'EMP',
        type: 'offboarding',
        subType: r.exitType || 'Resignation',
        dateText: r.lastWorkingDay ? new Date(r.lastWorkingDay).toLocaleDateString('en-IN') : 'Not Set',
        days: null,
        reason: r.exitReason || r.remarks || 'No reason provided',
        status: r.status === 'pending_hr' ? 'pending' : (r.status === 'accepted' ? 'accepted' : (r.status === 'rejected' ? 'rejected' : 'pending')),
        managerStatus: r.managerStatus || 'pending',
        hrStatus: r.status === 'accepted' ? 'accepted' : (r.status === 'rejected' ? 'rejected' : 'pending'),
        rejectionReason: r.remarks,
        createdAt: r.createdAt,
        raw: r
      });
    });

    // 3. Intern Onboarding
    interns.forEach(i => {
      // 'initial' managerApprovalStatus means no manager assigned → goes directly to HR
      const internMgrStatus = i.managerApprovalStatus === 'initial' ? 'approved' : (i.managerApprovalStatus || 'pending');
      list.push({
        _id: i._id,
        requesterName: i.fullName,
        requesterId: i.internid || 'Pending ID',
        type: 'onboarding',
        subType: 'Intern',
        dateText: i.onboardingDate ? new Date(i.onboardingDate).toLocaleDateString('en-IN') : 'Not Configured',
        days: null,
        reason: `${i.role} at ${i.college || i.department || 'Softrate'}`,
        status: i.status === 'initial' ? 'pending' : (i.status === 'approved' || i.status === 'ongoing' ? 'accepted' : 'rejected'),
        managerStatus: internMgrStatus,
        hrStatus: i.status === 'approved' || i.status === 'ongoing' ? 'accepted' : 'pending',
        rejectionReason: i.managerRemarks || '',
        createdAt: i.createdAt,
        raw: i
      });
    });

    // 4. Employee Onboarding
    employees.forEach(e => {
      // 'null' or missing managerApprovalStatus means no manager assigned → goes directly to HR
      const empMgrStatus = (!e.managerApprovalStatus || e.managerApprovalStatus === null) ? 'approved' : e.managerApprovalStatus;
      list.push({
        _id: e._id,
        requesterName: e.fullName,
        requesterId: e.EmployeeId || 'Pending ID',
        type: 'onboarding',
        subType: 'Employee',
        dateText: e.onboardingDate ? new Date(e.onboardingDate).toLocaleDateString('en-IN') : 'Not Configured',
        days: null,
        reason: `${e.role || 'Member'} - ${e.department || 'Softrate'}`,
        status: e.status === 'initial' ? 'pending' : (e.status === 'approved' || e.status === 'ongoing' ? 'accepted' : 'rejected'),
        managerStatus: empMgrStatus,
        hrStatus: e.status === 'approved' || e.status === 'ongoing' ? 'accepted' : 'pending',
        rejectionReason: e.managerRemarks || '',
        createdAt: e.submittedAt || e.createdAt,
        raw: e
      });
    });

    // 5. Attendance Correction Requests
    corrections.forEach(c => {
      list.push({
        _id: c._id,
        requesterName: c.internName,
        requesterId: c.internId,
        type: 'correction',
        subType: 'Attendance Correction',
        dateText: new Date(c.date).toLocaleDateString('en-IN'),
        days: null,
        reason: `Miss Punch Correction Request. Punch In: ${this.formatTime(c.requestedPunchIn)} | Punch Out: ${this.formatTime(c.requestedPunchOut)}. Reason: ${c.reason}`,
        status: c.hrApprovalStatus || 'pending',
        managerStatus: c.managerApprovalStatus || 'pending',
        hrStatus: c.hrApprovalStatus || 'pending',
        rejectionReason: c.hrRemarks || '',
        createdAt: c.createdAt,
        raw: c
      });
    });

    // Sort by most recent
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.requestsList.set(list);
  }

  consolidateManagerData(managerId: string, leaves: any[], resignations: any[], interns: any[], employees: any[], corrections: any[]) {
    const list: any[] = [];

    // 1. Leave Requests for manager's team
    leaves.forEach(l => {
      list.push({
        _id: l._id,
        requesterName: l.employeeName,
        requesterId: l.employeeId,
        type: 'leave',
        subType: l.leaveType,
        dateText: `${new Date(l.fromDate).toLocaleDateString('en-IN')} - ${new Date(l.toDate).toLocaleDateString('en-IN')}`,
        days: l.numberOfDays,
        reason: l.reason,
        status: l.managerStatus, // Manager primarily reviews managerStatus
        managerStatus: l.managerStatus,
        hrStatus: l.hrStatus,
        rejectionReason: l.rejectionReason,
        createdAt: l.createdAt,
        raw: l
      });
    });

    // 2. Offboarding for manager's team only
    resignations.forEach(r => {
      if (r.managerId === managerId) {
        list.push({
          _id: r._id,
          requesterName: r.fullName,
          requesterId: r.internId || 'EMP',
          type: 'offboarding',
          subType: r.exitType || 'Resignation',
          dateText: r.lastWorkingDay ? new Date(r.lastWorkingDay).toLocaleDateString('en-IN') : 'Not Set',
          days: null,
          reason: r.exitReason || r.remarks || 'No reason provided',
          status: r.managerStatus || 'pending',
          managerStatus: r.managerStatus || 'pending',
          hrStatus: r.status === 'accepted' ? 'accepted' : (r.status === 'rejected' ? 'rejected' : 'pending'),
          rejectionReason: r.remarks,
          createdAt: r.createdAt,
          raw: r
        });
      }
    });

    // 3. Intern Onboarding (Initial assigned to this manager)
    interns.forEach(i => {
      list.push({
        _id: i._id,
        requesterName: i.fullName,
        requesterId: 'Pending ID',
        type: 'onboarding',
        subType: 'Intern',
        dateText: i.onboardingDate ? new Date(i.onboardingDate).toLocaleDateString('en-IN') : 'Not Configured',
        days: null,
        reason: `${i.role} at ${i.college || i.department}`,
        status: i.managerApprovalStatus || 'pending',
        managerStatus: i.managerApprovalStatus || 'pending',
        hrStatus: i.status === 'approved' || i.status === 'ongoing' ? 'accepted' : 'pending',
        rejectionReason: i.managerRemarks || '',
        createdAt: i.createdAt,
        raw: i
      });
    });

    // 4. Employee Onboarding (Initial assigned to this manager)
    employees.forEach(e => {
      list.push({
        _id: e._id,
        requesterName: e.fullName,
        requesterId: 'Pending ID',
        type: 'onboarding',
        subType: 'Employee',
        dateText: e.onboardingDate ? new Date(e.onboardingDate).toLocaleDateString('en-IN') : 'Not Configured',
        days: null,
        reason: `${e.role || 'Member'} - ${e.department}`,
        status: e.managerApprovalStatus || 'pending',
        managerStatus: e.managerApprovalStatus || 'pending',
        hrStatus: e.status === 'approved' || e.status === 'ongoing' ? 'accepted' : 'pending',
        rejectionReason: e.managerRemarks || '',
        createdAt: e.submittedAt || e.createdAt,
        raw: e
      });
    });

    // 5. Attendance Correction Requests for manager's team
    corrections.forEach(c => {
      list.push({
        _id: c._id,
        requesterName: c.internName,
        requesterId: c.internId,
        type: 'correction',
        subType: 'Attendance Correction',
        dateText: new Date(c.date).toLocaleDateString('en-IN'),
        days: null,
        reason: `Miss Punch Correction Request. Punch In: ${this.formatTime(c.requestedPunchIn)} | Punch Out: ${this.formatTime(c.requestedPunchOut)}. Reason: ${c.reason}`,
        status: c.managerApprovalStatus || 'pending',
        managerStatus: c.managerApprovalStatus || 'pending',
        hrStatus: c.hrApprovalStatus || 'pending',
        rejectionReason: c.managerRemarks || '',
        createdAt: c.createdAt,
        raw: c
      });
    });

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.requestsList.set(list);
  }

  // Computed signal for filtered list
  filteredRequests = computed(() => {
    let requests = this.requestsList();
    const cat = this.activeCategory();
    const query = this.searchQuery().toLowerCase().trim();

    // 1. Filter by Request Type
    if (cat !== 'all') {
      requests = requests.filter(r => r.type === cat);
    }

    // 2. Two-stage approval pipeline filter:
    //    - Manager: sees requests pending THEIR action (managerStatus still 'pending')
    //    - HR: sees requests manager already approved/accepted, now awaiting HR final action
    //      Also includes direct-to-HR items (no manager assigned)
    if (this.isHr()) {
      requests = requests.filter(r => {
        const mgrApproved =
          r.managerStatus === 'accepted' ||
          r.managerStatus === 'approved' ||
          r.managerStatus === 'accept';
        const hrPending = r.status === 'pending';
        return mgrApproved && hrPending;
      });
    } else {
      // Manager sees only their own pending queue
      requests = requests.filter(r => r.status === 'pending' && r.managerStatus === 'pending');
    }

    // 3. Search query
    if (query) {
      requests = requests.filter(r => 
        r.requesterName?.toLowerCase().includes(query) || 
        r.requesterId?.toLowerCase().includes(query) ||
        r.subType?.toLowerCase().includes(query) ||
        r.reason?.toLowerCase().includes(query)
      );
    }

    return requests;
  });

  // Action flow trigger
  openReview(request: any, action: 'approve' | 'reject') {
    this.selectedRequest.set(request);
    this.reviewAction.set(action);
    this.reviewRemarks.set('');
    
    // Default form variables for Onboarding action
    if (request.type === 'onboarding') {
      this.onboardingDate.set(this.getTodayDateString());
      this.endDate.set(this.getThreeMonthsDateString());
      this.internshipType.set('Stipend');
      this.assignedRole.set(request.raw.role || '');
    }

    // Default offboarding certificate flags
    this.certInternship.set(false);
    this.certProject.set(false);
    this.certLor.set(false);

    this.showReviewModal.set(true);
  }

  closeModal() {
    this.showReviewModal.set(false);
    this.selectedRequest.set(null);
    this.reviewAction.set(null);
    this.reviewRemarks.set('');
  }

  submitReview() {
    const request = this.selectedRequest();
    const action = this.reviewAction();
    if (!request || !action) return;

    this.loading.set(true);
    const remarks = this.reviewRemarks();

    if (request.type === 'leave') {
      this.handleLeaveReview(request, action, remarks);
    } else if (request.type === 'offboarding') {
      this.handleOffboardingReview(request, action, remarks);
    } else if (request.type === 'onboarding') {
      this.handleOnboardingReview(request, action, remarks);
    } else if (request.type === 'correction') {
      this.handleCorrectionReview(request, action, remarks);
    }
  }

  handleCorrectionReview(request: any, action: 'approve' | 'reject', remarks: string) {
    const status = action === 'approve' ? 'approved' : 'rejected';
    if (this.isHr()) {
      this.apiService.hrReviewAttendanceRequest(request._id, status, remarks).subscribe({
        next: () => {
          this.fetchRequests();
          this.closeModal();
          alert(`Attendance correction ${action}d successfully`);
        },
        error: (err) => {
          console.error(err);
          this.loading.set(false);
          alert('Action failed. Error: ' + err.message);
        }
      });
    } else if (this.isManager()) {
      this.apiService.managerReviewAttendanceRequest(request._id, status, remarks).subscribe({
        next: () => {
          this.fetchRequests();
          this.closeModal();
          alert(`Attendance correction ${action}d successfully`);
        },
        error: (err) => {
          console.error(err);
          this.loading.set(false);
          alert('Action failed. Error: ' + err.message);
        }
      });
    }
  }

  handleLeaveReview(request: any, action: 'approve' | 'reject', remarks: string) {
    if (this.isHr()) {
      const status = action === 'approve' ? 'approved' : 'rejected';
      this.apiService.hrReviewLeave(request._id, status, remarks).subscribe({
        next: () => {
          this.fetchRequests();
          this.closeModal();
          alert(`Leave request ${action}d successfully`);
        },
        error: (err) => {
          console.error(err);
          this.loading.set(false);
          alert('Action failed. Error: ' + err.message);
        }
      });
    } else if (this.isManager()) {
      const status = action === 'approve' ? 'accepted' : 'rejected';
      this.apiService.managerReviewLeave(request._id, status, remarks).subscribe({
        next: () => {
          this.fetchRequests();
          this.closeModal();
          alert(`Leave request ${action}d successfully`);
        },
        error: (err) => {
          console.error(err);
          this.loading.set(false);
          alert('Action failed. Error: ' + err.message);
        }
      });
    }
  }

  handleOffboardingReview(request: any, action: 'approve' | 'reject', remarks: string) {
    if (this.isHr()) {
      const apiAction = action === 'approve' ? 'accept' : 'reject';
      const flags = {
        internship: this.certInternship(),
        project: this.certProject(),
        lor: this.certLor()
      };
      this.apiService.hrReviewOffboarding(request._id, apiAction, remarks, flags).subscribe({
        next: () => {
          this.fetchRequests();
          this.closeModal();
          alert(`Offboarding request ${action}d successfully`);
        },
        error: (err) => {
          console.error(err);
          this.loading.set(false);
          alert('Action failed. Error: ' + err.message);
        }
      });
    } else if (this.isManager()) {
      const status = action === 'approve' ? 'approved' : 'rejected';
      this.apiService.managerReviewOffboarding(request._id, status, remarks).subscribe({
        next: () => {
          this.fetchRequests();
          this.closeModal();
          alert(`Offboarding request ${action}d successfully`);
        },
        error: (err) => {
          console.error(err);
          this.loading.set(false);
          alert('Action failed. Error: ' + err.message);
        }
      });
    }
  }

  handleOnboardingReview(request: any, action: 'approve' | 'reject', remarks: string) {
    const isIntern = request.subType === 'Intern';

    if (this.isHr()) {
      if (action === 'approve') {
        if (isIntern) {
          const acceptData = {
            onboardingDate: this.onboardingDate(),
            endDate: this.endDate(),
            internshipType: this.internshipType(),
            role: this.assignedRole()
          };
          this.apiService.acceptIntern(request._id, acceptData).subscribe({
            next: () => {
              this.fetchRequests();
              this.closeModal();
              alert(`Intern approved and onboarded successfully`);
            },
            error: (err) => {
              console.error(err);
              this.loading.set(false);
              alert('Action failed. Error: ' + err.message);
            }
          });
        } else {
          const acceptData = {
            onboardingDate: this.onboardingDate()
          };
          this.apiService.acceptEmployee(request._id, acceptData).subscribe({
            next: () => {
              this.fetchRequests();
              this.closeModal();
              alert(`Employee approved and onboarded successfully`);
            },
            error: (err) => {
              console.error(err);
              this.loading.set(false);
              alert('Action failed. Error: ' + err.message);
            }
          });
        }
      } else {
        // Reject/Delete
        const actionObservable = isIntern 
          ? this.apiService.deleteIntern(request._id)
          : this.apiService.deleteEmployee(request._id);

        actionObservable.subscribe({
          next: () => {
            this.fetchRequests();
            this.closeModal();
            alert(`Application rejected successfully`);
          },
          error: (err) => {
            console.error(err);
            this.loading.set(false);
            alert('Action failed. Error: ' + err.message);
          }
        });
      }
    } else if (this.isManager()) {
      // Manager Onboarding Review
      const status = action === 'approve' ? 'approved' : 'rejected';
      const actionObservable = isIntern
        ? this.apiService.managerReviewIntern(request._id, status, remarks)
        : this.apiService.managerReviewEmployee(request._id, status, remarks);

      actionObservable.subscribe({
        next: () => {
          this.fetchRequests();
          this.closeModal();
          alert(`Application review submitted successfully`);
        },
        error: (err) => {
          console.error(err);
          this.loading.set(false);
          alert('Action failed. Error: ' + err.message);
        }
      });
    }
  }

  // Pending queue computed — respects two-stage pipeline
  private get pipelineRequests() {
    const all = this.requestsList();
    if (this.isHr()) {
      // HR sees: manager approved, HR action still pending
      return all.filter(r =>
        r.status === 'pending' && (r.managerStatus === 'accepted' || r.managerStatus === 'approved')
      );
    } else {
      // Manager sees: their own pending queue
      return all.filter(r => r.status === 'pending' && r.managerStatus === 'pending');
    }
  }

  pendingCount = computed(() => this.pipelineRequests.length);
  pendingLeavesCount = computed(() => this.pipelineRequests.filter(r => r.type === 'leave').length);
  pendingOffboardingsCount = computed(() => this.pipelineRequests.filter(r => r.type === 'offboarding').length);
  pendingOnboardingsCount = computed(() => this.pipelineRequests.filter(r => r.type === 'onboarding').length);
  pendingCorrectionsCount = computed(() => this.pipelineRequests.filter(r => r.type === 'correction').length);

  formatTime(iso: string): string {
    if (!iso) return '--:--';
    const date = new Date(iso);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  // Helper date parsers
  private getTodayDateString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  private getThreeMonthsDateString(): string {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  }
}
