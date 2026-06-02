import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { Dashboard } from './features/dashboard/dashboard';
import { InternList } from './features/interns/intern-list/intern-list';
import { InternAdd } from './features/interns/intern-add/intern-add';
import { EmployeeList } from './features/employees/employee-list/employee-list';
import { InternDetails } from './features/interns/intern-details/intern-details';
import { InternAttendance } from './features/interns/intern-attendance/intern-attendance';
import { InternLeaves } from './features/interns/intern-leaves/intern-leaves';
import { InternReview } from './features/interns/intern-review/intern-review';
import { EmployeeDetails } from './features/employees/employee-details/employee-details';
import { EmployeeAttendance } from './features/employees/employee-attendance/employee-attendance';
import { EmployeePayroll } from './features/employees/employee-payroll/employee-payroll';
import { EmployeeReview } from './features/employees/employee-review/employee-review';
import { EmployeeLeaves } from './features/employees/employee-leaves/employee-leaves';
import { LeaveManagement } from './features/leaves/leave-management/leave-management';
import { OrgHierarchy } from './features/org-hierarchy/org-hierarchy';
import { HrPolicies } from './features/hr-policies/hr-policies';
import { HolidayCalendar } from './features/holiday-calendar/holiday-calendar';
import { InternRequests } from './features/interns/intern-requests/intern-requests';
import { EmployeeRequests } from './features/employees/employee-requests/employee-requests';
import { EmployeeDashboard } from './features/employees/employee-dashboard/employee-dashboard';
import { EmployeeAdd } from './features/employees/employee-add/employee-add';
import { AppSettings } from './features/app-settings/app-settings';
import { CertificateSettings } from './features/certificate-settings/certificate-settings';
import { OffboardingRequests } from './features/offboarding/offboarding-requests/offboarding-requests';
import { ProjectManagement } from './features/projects/project-management/project-management';
import { UnifiedRequests } from './features/unified-requests/unified-requests';
import { PayrollManagement } from './features/payroll/payroll-management/payroll-management';

import { PerformanceGoals } from './features/performance-goals/performance-goals';
import { TodayAttendance } from './features/attendance/today-attendance/today-attendance';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'dashboard', component: Dashboard },
  { path: 'payroll', component: PayrollManagement },
  { path: 'attendance/today', component: TodayAttendance },
  { path: 'employee/dashboard', component: EmployeeDashboard },
  { path: 'performance-goals', component: PerformanceGoals },
  { path: 'org-hierarchy', component: OrgHierarchy },
  { path: 'app-settings', component: AppSettings },
  { path: 'projects', component: ProjectManagement },
  { path: 'certificate-settings', component: CertificateSettings },
  { path: 'hr-policies', component: HrPolicies },
  { path: 'holiday-calendar', component: HolidayCalendar }, 
  { path: 'interns', component: InternList },
  { path: 'interns/requests', component: InternRequests },
  { path: 'interns/approve/:id', component: InternAdd },
  { path: 'interns/:id', component: InternDetails },
  { path: 'interns/:id/attendance', component: InternAttendance },
  { path: 'interns/:id/leaves', component: InternLeaves },
  { path: 'interns/:id/review', component: InternReview },
  { path: 'employees', component: EmployeeList },
  { path: 'employees/requests', component: EmployeeRequests },
  { path: 'employees/add', component: EmployeeAdd },
  { path: 'employees/add/:id', component: EmployeeAdd },
  { path: 'employees/approve/:id', component: EmployeeAdd }, // We'll update details to handle approval if needed, or create EmployeeApprove
  { path: 'employees/:id', component: EmployeeDetails },
  { path: 'employees/:id/attendance', component: EmployeeAttendance },
  { path: 'employees/:id/payroll', component: EmployeePayroll },
  { path: 'employees/:id/review', component: EmployeeReview },
  { path: 'employee/attendance', component: EmployeeAttendance },
  { path: 'employee/leaves', component: EmployeeLeaves },
  { path: 'employee/payroll', component: EmployeePayroll },
  { path: 'employee/org-hierarchy', component: OrgHierarchy },
  { path: 'employee/hr-policies', component: HrPolicies },
  { path: 'employee/projects', component: ProjectManagement },
  { path: 'leaves', component: LeaveManagement },
  { path: 'assignments', loadComponent: () => import('./features/assignments/manager-assignments/manager-assignments').then(m => m.ManagerAssignments) },
  { path: 'manager/reviews', loadComponent: () => import('./features/manager/team-reviews/team-reviews').then(m => m.TeamReviews) },
  { path: 'offboarding', component: OffboardingRequests },
  { path: 'approvals', component: UnifiedRequests },
  { path: 'interns/attendance/corrections', loadComponent: () => import('./features/interns/attendance-corrections/attendance-corrections').then(m => m.AttendanceCorrections) },
];
