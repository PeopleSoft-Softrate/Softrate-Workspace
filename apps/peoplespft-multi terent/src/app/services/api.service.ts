import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private useLocalBackend = false;
  private baseUrl = this.useLocalBackend
    ? 'http://localhost:5001'
    : 'https://workspace.softrateglobal.com/hrms-api';


  constructor(private http: HttpClient) { }

  private getHeaders() {
    return {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
  }

  private addCacheBuster(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_t=${new Date().getTime()}`;
  }

  // Authentication
  login(companyCode: string, identifier: string, password: string): Observable<any> {
    // Unified login handles email, employeeId, and internId
    return this.http.post(`${this.baseUrl}/api/auth/unified-login`, {
      companyCode: companyCode,
      identifier: identifier,
      password
    });
  }

  getMe(): Observable<any> {
    return this.http.get(this.addCacheBuster(`${this.baseUrl}/api/auth/me`), { headers: this.getHeaders() });
  }

  updateProfilePhoto(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('profilePhoto', file);
    return this.http.patch(`${this.baseUrl}/api/auth/me/profile-photo`, formData);
  }

  removeProfilePhoto(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/auth/me/profile-photo`);
  }

  hrLogin(email: string, password: string): Observable<any> {
    return this.login('', email, password);
  }

  employeeLogin(employeeId: string, password: string): Observable<any> {
    return this.login('', employeeId, password);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  registerCompany(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/onboarding/register`, data);
  }

  toggleManager(id: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/employee/toggle-manager/${id}`, {});
  }

  // Dashboard Stats
  getDashboardStats(): Observable<any> {
    return forkJoin({
      activeInterns: this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/intern/all/active`), { headers: this.getHeaders() }),
      initialInterns: this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/intern/all/initial`), { headers: this.getHeaders() }),
      activeEmployees: this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/employee/all/active`), { headers: this.getHeaders() }),
      internAttendance: this.http.get<any>(this.addCacheBuster(`${this.baseUrl}/api/attendance/today/all`), { headers: this.getHeaders() }).pipe(
        map(res => {
          if (res && res.attendance) res.attendance = res.attendance.filter((a: any) => a.status?.toLowerCase() !== 'initial');
          return res;
        })
      ),
      employeeAttendance: this.http.get<any>(this.addCacheBuster(`${this.baseUrl}/api/employeeAttanance/employee/today/all`), { headers: this.getHeaders() }).pipe(
        map(res => {
          if (res && res.attendance) res.attendance = res.attendance.filter((a: any) => a.status?.toLowerCase() !== 'initial');
          return res;
        })
      ),
      pendingLeaves: this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/employee-leave/hr-pending`), { headers: this.getHeaders() }),
      activeProjects: this.http.get<any>(this.addCacheBuster(`${this.baseUrl}/api/projects/all`), { headers: this.getHeaders() }),
      internTrend: this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/attendance/trend`), { headers: this.getHeaders() }),
      employeeTrend: this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/employeeAttanance/trend`), { headers: this.getHeaders() }),
    }).pipe(
      map(data => {
        // Map recent activities
        const activities: any[] = [];

        const getRelativeTime = (dateStr: string) => {
          if (!dateStr) return 'Recently';
          const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 60000);
          if (diff < 1) return 'Just now';
          if (diff < 60) return `${diff} mins ago`;
          if (diff < 1440) return `${Math.floor(diff / 60)} hrs ago`;
          return `${Math.floor(diff / 1440)} days ago`;
        };

        // Add recent intern applications
        if (data.initialInterns && data.initialInterns.length > 0) {
          data.initialInterns.slice(-4).forEach(intern => {
            activities.push({
              title: intern.fullName,
              initials: intern.fullName?.[0] || 'I',
              description: `Applied for ${intern.role || 'Internship'}`,
              time: getRelativeTime(intern.createdAt || new Date()),
              badge: 'New Intern',
              badgeColor: 'blue',
              color: 'blue'
            });
          });
        }

        // Add pending leaves
        if (data.pendingLeaves && data.pendingLeaves.length > 0) {
          data.pendingLeaves.slice(-4).forEach(leave => {
            activities.push({
              title: leave.employeeName || 'Staff',
              initials: (leave.employeeName || 'S')[0],
              description: `Requested ${leave.leaveType || 'Leave'}`,
              time: getRelativeTime(leave.createdAt || new Date()),
              badge: 'Pending',
              badgeColor: 'orange',
              color: 'orange'
            });
          });
        }

        // Ensure we always have 7 days for the chart, even if backend returns fewer
        const fillMissingDays = (trendArray: any[]) => {
          if (!trendArray) return [];
          if (trendArray.length >= 7) return trendArray.slice(-7);

          const daysFallback = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          const result = [];
          const missingCount = 7 - trendArray.length;

          for (let i = 0; i < 7; i++) {
            if (i < missingCount) {
              // Pad older missing days with 0 counts
              result.push({ day: daysFallback[i], count: 0 });
            } else {
              // Use actual data
              const actualData = trendArray[i - missingCount];
              result.push({ day: actualData.day || daysFallback[i], count: actualData.count || 0 });
            }
          }
          return result;
        };

        const fullInternTrend = fillMissingDays(data.internTrend);
        const fullEmployeeTrend = fillMissingDays(data.employeeTrend);

        const maxIntern = Math.max(...fullInternTrend.map(t => t.count), 1);
        const maxEmployee = Math.max(...fullEmployeeTrend.map(t => t.count), 1);

        // Calculate actual day-over-day attendance trend if available
        const getTrend = (trendData: any[]) => {
          if (!trendData || trendData.length < 2) return '+0%';
          const current = trendData[trendData.length - 1].count;
          const prev = trendData[trendData.length - 2].count;
          if (prev === 0) return current > 0 ? '+100%' : '0%';
          const diff = ((current - prev) / prev) * 100;
          return diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
        };

        const internAttTrend = getTrend(data.internTrend);
        const empAttTrend = getTrend(data.employeeTrend);

        // Calculate Analytics Summary
        const getSummary = (trendArray: any[], totalPeople: number, maxCount: number) => {
          const total = Math.max(totalPeople, 1);
          const validDays = trendArray.filter(t => t.count > 0);

          if (validDays.length === 0) {
            return { avgPresent: '0%', avgAbsent: '0%', bestDay: 'N/A', avgLineHeight: 0 };
          }

          const sum = validDays.reduce((acc, curr) => acc + curr.count, 0);
          const avgCount = sum / validDays.length;

          const avgPresentPct = Math.min((avgCount / total) * 100, 100);
          const avgAbsentPct = Math.max(100 - avgPresentPct, 0);

          let best = validDays[0];
          for (const d of validDays) {
            if (d.count > best.count) best = d;
          }

          const getFullDayName = (dayStr: string) => {
            if (!dayStr) return 'N/A';
            const map: { [key: string]: string } = {
              'M': 'Monday', 'Mon': 'Monday', 'Monday': 'Monday',
              'T': 'Tuesday', 'Tue': 'Tuesday', 'Tuesday': 'Tuesday',
              'W': 'Wednesday', 'Wed': 'Wednesday', 'Wednesday': 'Wednesday',
              'Th': 'Thursday', 'Thu': 'Thursday', 'Thursday': 'Thursday',
              'F': 'Friday', 'Fri': 'Friday', 'Friday': 'Friday',
              'S': 'Saturday', 'Sat': 'Saturday', 'Saturday': 'Saturday',
              'Su': 'Sunday', 'Sun': 'Sunday', 'Sunday': 'Sunday'
            };
            // Fallback to the original string if it's not a known abbreviation (e.g. a date)
            return map[dayStr] || dayStr;
          };

          const avgLineHeight = maxCount > 0 ? (avgCount / maxCount) * 100 : 0;

          return {
            avgPresent: `${Math.round(avgPresentPct)}%`,
            avgAbsent: `${Math.round(avgAbsentPct)}%`,
            bestDay: getFullDayName(best.day),
            avgLineHeight: avgLineHeight
          };
        };

        const internSummary = getSummary(fullInternTrend, data.activeInterns?.length || 0, maxIntern);
        const employeeSummary = getSummary(fullEmployeeTrend, data.activeEmployees?.length || 0, maxEmployee);

        const now = new Date();
        const totalInternsCount = (data.activeInterns || []).filter(i => {
           if (!i.onboardingDate) return false;
           return new Date(i.onboardingDate) <= now;
        }).length;

        return {
          interns: [
            { label: 'Total Interns', value: totalInternsCount.toString(), icon: 'fa-solid fa-users', color: 'teal', link: '/interns', trend: '+4.1%' },
            { label: 'Active Interns', value: data.internAttendance.count.toString(), icon: 'fa-solid fa-fingerprint', color: 'green', link: '/attendance/today', trend: internAttTrend },
            { label: 'Pending Leaves', value: data.pendingLeaves.length.toString(), icon: 'fa-solid fa-clock', color: 'orange', link: '/leaves', trend: '-2.5%' },
            { label: 'New Applications', value: data.initialInterns.length.toString(), icon: 'fa-solid fa-user-plus', color: 'blue', link: '/interns/requests', trend: '+12%' }
          ],
          employees: [
            { label: 'Today Attendance', value: data.employeeAttendance.count.toString(), icon: 'fa-solid fa-circle-check', color: 'green', link: '/attendance/today', trend: empAttTrend },
            { label: 'Total Employees', value: data.activeEmployees.length.toString(), icon: 'fa-solid fa-briefcase', color: 'teal', link: '/employees', trend: '+1.5%' },
            { label: 'Active Projects', value: (data.activeProjects.projects?.length || 0).toString(), icon: 'fa-solid fa-list-ul', color: 'purple', link: '/projects', trend: '+5.0%' },
            { label: 'Payroll Status', value: 'Paid', icon: 'fa-solid fa-circle-dollar-to-slot', color: 'green', link: '/employees', trend: '100%' }
          ],
          internTrend: fullInternTrend.map(t => ({ ...t, height: (t.count / maxIntern) * 100 })),
          employeeTrend: fullEmployeeTrend.map(t => ({ ...t, height: (t.count / maxEmployee) * 100 })),
          internSummary,
          employeeSummary,
          activities: activities.length > 0 ? activities.reverse().slice(0, 3) : [
            { title: 'No recent activity', description: 'Everything is up to date', time: 'Now', icon: 'fa-solid fa-circle-check', color: 'green' }
          ]
        };
      })
    );
  }

  // Interns
  getAllActiveInterns(range: string = 'all', status: string = 'all'): Observable<any[]> {
    return this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/intern/all/active`), {
      params: { range, status },
      headers: this.getHeaders()
    });
  }

  getPendingInterns(): Observable<any[]> {
    return this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/intern/all/pending`), {
      headers: this.getHeaders()
    });
  }
  getInternById(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/intern/get/${id}`).pipe(
      map(res => res.intern)
    );
  }

  addIntern(intern: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/intern/add`, intern);
  }

  // Employees
  getAllEmployees(range: string = 'all', status: string = 'all'): Observable<any[]> {
    return this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/employee/all/active`), {
      params: { range, status },
      headers: this.getHeaders()
    });
  }

  getPendingEmployees(): Observable<any[]> {
    return this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/employee/all/pending`), {
      headers: this.getHeaders()
    });
  }

  addEmployee(employee: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/employee/add`, employee);
  }

  getEmployeeById(id: string): Observable<any> {
    return this.http.get<any>(this.addCacheBuster(`${this.baseUrl}/api/employee/get/${id}`), { headers: this.getHeaders() }).pipe(
      map(res => res.employee)
    );
  }

  updateEmployee(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/employee/update/${id}`, data);
  }

  updateIntern(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/intern/update/${id}`, data);
  }

  // Attendance
  getInternAttendance(internId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/attendance/intern/${internId}`);
  }

  getEmployeeAttendance(employeeId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/employeeAttanance/employee/${employeeId}`);
  }

  employeePunchIn(employeeId: string, location: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/employeeAttanance/punch-in`, { employeeId, location });
  }

  employeePunchOut(employeeId: string, location: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/employeeAttanance/punch-out`, { employeeId, location });
  }

  getEmployeeTodayAttendance(employeeId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/employeeAttanance/today/${employeeId}`);
  }

  // Leaves
  applyLeave(formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/employee-leave/apply`, formData);
  }

  getInternLeaves(internId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/employee-leave/employee/${internId}`);
  }

  getEmployeeLeaves(employeeId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/employee-leave/employee/${employeeId}`);
  }

  getEmployeeLeaveBalance(employeeId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/employee-leave/balance/${employeeId}`);
  }

  getEmployeeProjects(memberId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/projects/member/${memberId}`);
  }

  // Reviews
  getInternReview(internId: string, month: string = ''): Observable<any> {
    const url = `${this.baseUrl}/api/reviews/${internId}`;
    const params: { [key: string]: string } = {};
    if (month) params['month'] = month;
    return this.http.get<any>(url, { params });
  }

  gradeInternReview(internId: string, month: string, goals: any[]): Observable<any> {
    const url = `${this.baseUrl}/api/reviews/${internId}/grade`;
    const params: { [key: string]: string } = { month };
    return this.http.put<any>(url, { goals }, { params });
  }

  getEmployeeReview(employeeId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/employee-reviews/employee/${employeeId}`);
  }

  // Holidays
  getHolidays(): Observable<any[]> {
    return this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/holidays`), { headers: this.getHeaders() });
  }

  saveHoliday(holiday: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/holidays`, holiday);
  }

  saveBulkHolidays(holidays: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/holidays/bulk`, holidays);
  }

  deleteHoliday(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/holidays/${id}`);
  }

  // Policies
  getPolicies(): Observable<any[]> {
    return this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/policy/all`), { headers: this.getHeaders() });
  }

  savePolicy(policy: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/policy/add`, policy);
  }

  deletePolicy(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/policy/${id}`);
  }

  // Hierarchy (Org Hierarchy)
  getOrgHierarchy(): Observable<any> {
    return this.http.get<any>(this.addCacheBuster(`${this.baseUrl}/api/hr/policy`), { headers: this.getHeaders() });
  }

  getGlobalPolicyUrl(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/hr/policy-only`);
  }

  saveOrgHierarchy(url: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/hr/policy/save`, {
      policyUrl: url
    });
  }
  acceptIntern(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/intern/accept/${id}`, data);
  }
  deleteIntern(id: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/intern/reject/${id}`, {});
  }
  deleteEmployee(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/employee/reject/${id}`);
  }
  acceptEmployee(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/employee/accept/${id}`, data);
  }

  // Manager Assignment & Review
  getManagers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/employee/all/active`, {
      params: { range: 'all', status: 'approved' }
    }).pipe(
      map(emps => emps.filter(e => e.isManager === true && e.isHr !== true))
    );
  }

  assignInternToManager(internId: string, managerId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/intern/assign-manager/${internId}`, { managerId });
  }

  getAssignedInterns(managerId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/intern/assigned-to/${managerId}`);
  }

  managerReviewIntern(internId: string, status: 'approved' | 'rejected', remarks: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/intern/manager-review/${internId}`, { status, remarks });
  }

  // Attendance Correction Requests (HR & Manager)
  getHrPendingAttendanceRequests(): Observable<any[]> {
    return this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/attendance-requests/hr-pending`));
  }

  hrReviewAttendanceRequest(requestId: string, status: 'approved' | 'rejected', remarks: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/attendance-requests/hr-review/${requestId}`, { status, remarks });
  }

  getManagerPendingAttendanceRequests(managerId: string): Observable<any[]> {
    return this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/attendance-requests/manager/${managerId}`));
  }

  managerReviewAttendanceRequest(requestId: string, status: 'approved' | 'rejected', remarks: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/attendance-requests/manager-review/${requestId}`, { status, remarks });
  }

  // HR Leave Management
  getHrPendingLeaves(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/employee-leave/hr-pending`);
  }

  hrReviewLeave(id: string, status: 'approved' | 'rejected', rejectionReason: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/employee-leave/hr-action/${id}`, { status, rejectionReason });
  }

  // Company Settings
  getCompanySettings(): Observable<any> {
    return this.http.get<any>(this.addCacheBuster(`${this.baseUrl}/api/settings/company`), { headers: this.getHeaders() });
  }

  updateCompanySettings(settings: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/settings/company`, settings);
  }

  // Offboarding / Resignations
  getPendingOffboarding(): Observable<any[]> {
    return this.http.get<any>(`${this.baseUrl}/api/resignation/all`).pipe(
      map(res => res.data)
    );
  }

  getManagerPendingOffboarding(managerId: string): Observable<any[]> {
    return this.http.get<any>(`${this.baseUrl}/api/resignation/manager-pending/${managerId}`).pipe(
      map(res => res.data)
    );
  }

  getAllResignations(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/resignation/all`);
  }

  getHRPendingResignations(): Observable<any> {
    return this.getAllResignations();
  }

  managerReviewOffboarding(id: string, status: 'approved' | 'rejected', remarks: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/resignation/manager-review/${id}`, { status, remarks });
  }

  hrReviewOffboarding(id: string, action: 'accept' | 'reject', remarks: string, flags: { internship: boolean, project: boolean, lor: boolean } = { internship: false, project: false, lor: false }): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/resignation/hr-review/${action}/${id}`, {
      remarks,
      internship: flags.internship,
      project: flags.project,
      lor: flags.lor
    });
  }

  // Performance Templates
  getPerformanceTemplates(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/performance-templates`);
  }

  savePerformanceTemplate(template: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/performance-templates`, template);
  }

  deletePerformanceTemplate(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/performance-templates/${id}`);
  }

  // Projects
  getManagerProjects(managerId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/projects/manager/${managerId}`);
  }

  getAllProjects(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/projects/all`);
  }

  getManagerTeam(managerId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/assignments/team/${managerId}`);
  }

  getGlobalTeam(): Observable<any> {
    return forkJoin({
      interns: this.http.get<any[]>(`${this.baseUrl}/api/intern/all/active`),
      employees: this.http.get<any[]>(`${this.baseUrl}/api/employee/all/active`)
    });
  }

  createProject(project: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/projects/create`, project);
  }

  updateProject(projectId: string, project: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/projects/update/${projectId}`, project);
  }

  toggleProjectTask(projectId: string, taskId: string, userId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/projects/toggle-task/${projectId}/${taskId}`, { userId });
  }

  deleteProject(projectId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/projects/${projectId}`);
  }

  // Generic Download with Auth
  downloadFile(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }

  // Promotions & Conversions
  convertInternToEmployee(internId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/convert/intern-to-employee/${internId}`, {});
  }

  promoteToManager(employeeId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/convert/employee-to-manager/${employeeId}`, {});
  }

  convertToHr(staffId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/convert/to-hr/${staffId}`, {});
  }
  demoteToManager(staffId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/convert/hr-to-manager/${staffId}`, {});
  }

  demoteManagerToEmployee(staffId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/convert/manager-to-employee/${staffId}`, {});
  }

  terminateStaff(staffId: string, type: 'intern' | 'employee', reason: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/convert/terminate/${staffId}`, { type, reason });
  }

  getTodayUnifiedAttendance(managerId?: string): Observable<any> {
    let url = `${this.baseUrl}/api/attendance/today/unified`;
    const params: any = {};
    if (managerId) params.managerId = managerId;
    return this.http.get<any>(this.addCacheBuster(url), { params, headers: this.getHeaders() }).pipe(
      map(data => {
        if (data && data.attendance) {
          data.attendance = data.attendance.filter((a: any) => a.status?.toLowerCase() !== 'initial');
        }
        return data;
      })
    );
  }

  // Manager leaves and onboarding requests reviews
  getManagerPendingLeaves(managerId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/employee-leave/manager-pending/${managerId}`);
  }

  managerReviewLeave(leaveId: string, status: 'accepted' | 'rejected', rejectionReason: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/employee-leave/manager-action/${leaveId}`, { status, rejectionReason });
  }

  getAssignedEmployees(managerId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/employee/assigned-to/${managerId}`);
  }

  managerReviewEmployee(employeeId: string, status: 'approved' | 'rejected', remarks: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/employee/manager-review/${employeeId}`, { status, remarks });
  }

  getAllLeaves(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/employee-leave/all`);
  }

  getHRPendingLeaves(): Observable<any[]> {
    return this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/employee-leave/hr-pending`), {
      headers: this.getHeaders()
    });
  }

  getManagerAllLeaves(managerId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/employee-leave/manager-all/${managerId}`);
  }

  // Fund Requests
  getHrAllFundRequests(): Observable<any[]> {
    return this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/fund-requests/hr-all`), {
      headers: this.getHeaders()
    });
  }

  getManagerAllFundRequests(managerId: string): Observable<any[]> {
    return this.http.get<any[]>(this.addCacheBuster(`${this.baseUrl}/api/fund-requests/manager-all/${managerId}`), {
      headers: this.getHeaders()
    });
  }

  hrReviewFundRequest(requestId: string, status: 'accepted' | 'rejected', remarks: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/fund-requests/hr-action/${requestId}`, { status, remarks });
  }

  managerReviewFundRequest(requestId: string, status: 'accepted' | 'rejected', remarks: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/fund-requests/manager-action/${requestId}`, { status, remarks });
  }

  // --- Device Change Requests ---
  getHrPendingDeviceRequests(): Observable<any> {
    return this.http.get(this.addCacheBuster(`${this.baseUrl}/api/device-change-requests/hr-pending`), { headers: this.getHeaders() });
  }

  getManagerPendingDeviceRequests(managerId: string): Observable<any> {
    return this.http.get(this.addCacheBuster(`${this.baseUrl}/api/device-change-requests/manager-pending/${managerId}`), { headers: this.getHeaders() });
  }

  managerReviewDeviceRequest(id: string, status: string, remarks: string): Observable<any> {
    const action = (status === 'approved' || status === 'accepted') ? 'approve' : 'reject';
    return this.http.post(`${this.baseUrl}/api/device-change-requests/${id}/${action}`, { remarks });
  }

  hrReviewDeviceRequest(id: string, status: string, remarks: string): Observable<any> {
    const action = (status === 'approved' || status === 'accepted') ? 'approve' : 'reject';
    return this.http.post(`${this.baseUrl}/api/device-change-requests/${id}/${action}`, { remarks });
  }
}
