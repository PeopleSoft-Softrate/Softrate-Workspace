import { Injectable } from '@angular/core';
import { driver } from 'driver.js';

@Injectable({
  providedIn: 'root'
})
export class TourService {

  constructor() { }

  startPageTour(pageId: string, steps: any[]) {
    const tourKey = `peoplesoft_tour_completed_${pageId}`;
    const hasSeenTour = localStorage.getItem(tourKey);
    if (hasSeenTour) {
      return;
    }

    const tourObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      allowClose: true,
      doneBtnText: 'Finish Tour',
      nextBtnText: 'Next',
      prevBtnText: 'Previous',
      overlayColor: 'rgba(15, 23, 42, 0.75)',
      steps: steps,
      onDestroyed: () => {
        localStorage.setItem(tourKey, 'true');
      }
    });

    tourObj.drive();
  }

  startDashboardTour() {
    this.startPageTour('dashboard', [
      {
        popover: {
          title: 'Welcome to the Platform!',
          description: 'Let us show you around your new HR Dashboard. We\'ve set up some demo data so you can see how things look in action.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#tour-stats',
        popover: {
          title: 'Key Metrics',
          description: 'Get an instant overview of your workforce. Track active employees, total interns, and daily attendance.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-actions',
        popover: {
          title: 'Quick Actions',
          description: 'Need to add a new employee, process a leave request, or handle offboarding? These quick links save you time.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-insights',
        popover: {
          title: 'HR Insights',
          description: 'Monitor real-time productivity stats like Average Work Hours and Task Completion Rates across the company.',
          side: 'left',
          align: 'start'
        }
      },
      {
        element: '#tour-approvals',
        popover: {
          title: 'Approvals Hub',
          description: 'Review and approve all incoming requests (leaves, reimbursements, regularisation) right from here.',
          side: 'top',
          align: 'start'
        }
      }
    ]);
  }

  startEmployeesTour() {
    this.startPageTour('employees', [
      {
        element: '#tour-emp-sidebar',
        popover: {
          title: 'Employee Actions',
          description: 'Use the sidebar to add new requests, export data, or manage leave and offboarding.',
          side: 'left',
          align: 'start'
        }
      },
      {
        element: '#tour-emp-filters',
        popover: {
          title: 'Search & Filters',
          description: 'Find employees instantly by searching their name, or filter by department, role, and status.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-emp-table',
        popover: {
          title: 'Employee Directory',
          description: 'View all employee details. You can click on the row actions to edit, manage documents, or initiate offboarding.',
          side: 'top',
          align: 'start'
        }
      }
    ]);
  }

  startInternsTour() {
    this.startPageTour('interns', [
      {
        element: '#tour-intern-sidebar',
        popover: {
          title: 'Intern Actions',
          description: 'Use the sidebar to onboard a new intern, view requests, or export data.',
          side: 'left',
          align: 'start'
        }
      },
      {
        element: '#tour-intern-tabs',
        popover: {
          title: 'Manage Cohorts',
          description: 'Toggle between Active and Completed interns to view past batches and current trainees.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-intern-list',
        popover: {
          title: 'Intern Roster',
          description: 'Monitor all intern details, log performance reviews, and track their end dates.',
          side: 'top',
          align: 'start'
        }
      }
    ]);
  }

  startApprovalsTour() {
    this.startPageTour('approvals', [
      {
        element: '#tour-approvals-tabs',
        popover: {
          title: 'Request Categories',
          description: 'Filter pending approvals by type: Leaves, Regularisation, Reimbursements, etc.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-approvals-search',
        popover: {
          title: 'Find Requests',
          description: 'Search for requests by applicant name, ID, or department.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-approvals-list',
        popover: {
          title: 'Pending Requests',
          description: 'Review the details of each request. Click on any row to open the approval modal where you can approve or reject the request with remarks.',
          side: 'top',
          align: 'start'
        }
      }
    ]);
  }

  startAssignmentsTour() {
    this.startPageTour('assignments', [
      { element: '#tour-assignments-header', popover: { title: 'Team Assignments', description: 'Manage project allocations and team structures here.', side: 'bottom', align: 'start' } },
      { element: '#tour-assignments-filters', popover: { title: 'Filters', description: 'Filter assignments by project or department.', side: 'bottom', align: 'start' } },
      { element: '#tour-assignments-list', popover: { title: 'Assignments List', description: 'View and manage individual team assignments.', side: 'top', align: 'start' } }
    ]);
  }

  startPayrollTour() {
    this.startPageTour('payroll', [
      { element: '#tour-payroll-header', popover: { title: 'Payroll Management', description: 'Process salaries, view payslips, and manage compensation.', side: 'bottom', align: 'start' } },
      { element: '#tour-payroll-filters', popover: { title: 'Search & Filters', description: 'Find specific employee records or filter by status.', side: 'bottom', align: 'start' } },
      { element: '#tour-payroll-list', popover: { title: 'Payroll Records', description: 'Review and process individual payroll records.', side: 'top', align: 'start' } }
    ]);
  }

  startOrgHierarchyTour() {
    this.startPageTour('org-hierarchy', [
      { element: '#tour-org-header', popover: { title: 'Organizational Hierarchy', description: 'Visualize and manage the company structure reporting lines.', side: 'bottom', align: 'start' } },
      { element: '#tour-org-controls', popover: { title: 'Document URL', description: 'Paste the public URL of your organization chart (Google Drive, Dropbox, or PDF).', side: 'bottom', align: 'start' } },
      { element: '#tour-org-actions', popover: { title: 'Publish Changes', description: 'Save and publish the URL to update the team view.', side: 'top', align: 'start' } }
    ]);
  }

  startHrPolicyTour() {
    this.startPageTour('hr-policies', [
      { element: '#tour-policy-header', popover: { title: 'HR Policies', description: 'Manage company policies and handbooks.', side: 'bottom', align: 'start' } },
      { element: '#tour-policy-add', popover: { title: 'Create Policy', description: 'Upload or create new policy documents.', side: 'left', align: 'start' } },
      { element: '#tour-policy-list', popover: { title: 'Policy Documents', description: 'View, edit, and track acknowledgement of existing policies.', side: 'top', align: 'start' } }
    ]);
  }

  startPerformanceGoalsTour() {
    this.startPageTour('performance-goals', [
      { element: '#tour-goals-header', popover: { title: 'Performance Goals', description: 'Set and track key performance indicators.', side: 'bottom', align: 'start' } },
      { element: '#tour-goals-add', popover: { title: 'New Template', description: 'Create new performance review templates.', side: 'left', align: 'start' } },
      { element: '#tour-goals-list', popover: { title: 'Goal Templates', description: 'Manage and assign your performance templates.', side: 'top', align: 'start' } }
    ]);
  }

  startHolidayCalendarTour() {
    this.startPageTour('holiday-calendar', [
      { element: '#tour-holiday-header', popover: { title: 'Holiday Calendar', description: 'Manage public holidays and company off-days.', side: 'bottom', align: 'start' } },
      { element: '#tour-holiday-add', popover: { title: 'Add Holiday', description: 'Schedule new holidays into the calendar.', side: 'left', align: 'start' } },
      { element: '#tour-holiday-list', popover: { title: 'Calendar View', description: 'View upcoming holidays for the year.', side: 'top', align: 'start' } }
    ]);
  }

  startCertificateSettingsTour() {
    this.startPageTour('certificate-settings', [
      { element: '#tour-cert-header', popover: { title: 'Certificates & Documents', description: 'Manage document templates like offer letters and LORs.', side: 'bottom', align: 'start' } },
      { element: '#tour-cert-add', popover: { title: 'New Template', description: 'Upload new document templates.', side: 'left', align: 'start' } },
      { element: '#tour-cert-list', popover: { title: 'Template Library', description: 'View and manage your existing templates.', side: 'top', align: 'start' } }
    ]);
  }

  startAppSettingsTour() {
    this.startPageTour('app-settings', [
      { element: '#tour-settings-header', popover: { title: 'App Settings', description: 'Configure global application preferences.', side: 'bottom', align: 'start' } },
      { element: '#tour-settings-nav', popover: { title: 'Settings Categories', description: 'Navigate between different configuration sections.', side: 'bottom', align: 'start' } },
      { element: '#tour-settings-form', popover: { title: 'Configuration Options', description: 'Update and save your company settings here.', side: 'top', align: 'start' } }
    ]);
  }
}
