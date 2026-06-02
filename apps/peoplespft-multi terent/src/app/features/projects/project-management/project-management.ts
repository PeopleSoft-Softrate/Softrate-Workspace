import { AlertService } from '../../../shared/services/alert';
import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { SocketService } from '../../../services/socket.service';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { 
  DashboardSquare02Icon, 
  PlusSignIcon, 
  Delete02Icon, 
  CheckmarkCircle01Icon,
  Task01Icon,
  UserGroupIcon,
  Calendar03Icon,
  MoreVerticalIcon
} from '@hugeicons/core-free-icons';
import { finalize, forkJoin } from 'rxjs';

interface ProjectTask {
  _id?: string;
  task: string;
  isCompleted: boolean;
  completedBy?: string;
  completedAt?: Date;
}

interface Project {
  _id: string;
  title: string;
  client?: string;
  description?: string;
  startDate: Date;
  deadline?: Date;
  managerId: string;
  teamMembers: any[];
  checklist: ProjectTask[];
  status: string;
  progress: number;
}

@Component({
  selector: 'app-project-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HugeiconsIconComponent],
  templateUrl: './project-management.html',
  styleUrl: './project-management.css'
})
export class ProjectManagement implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);
  private socketService = inject(SocketService);
  private router = inject(Router);

  readonly DashboardSquare02Icon = DashboardSquare02Icon;
  readonly PlusSignIcon = PlusSignIcon;
  readonly Delete02Icon = Delete02Icon;
  readonly CheckmarkCircle01Icon = CheckmarkCircle01Icon;
  readonly Task01Icon = Task01Icon;
  readonly UserGroupIcon = UserGroupIcon;
  readonly Calendar03Icon = Calendar03Icon;
  readonly MoreVerticalIcon = MoreVerticalIcon;

  userRole = signal<string | null>(localStorage.getItem('user_role'));
  currentUser = signal<any>(null);
  isSelfPortal = signal<boolean>(false);

  projects = signal<Project[]>([]);
  teamMembers = signal<any[]>([]); // Potential members (interns + employees)
  isLoading = signal(true);
  showAddModal = signal(false);
  isEditMode = signal(false);
  editingProjectId = signal<string | null>(null);
  activeMenuId = signal<string | null>(null);

  // Form State
  newProject = signal<any>({
    title: '',
    client: '',
    description: '',
    deadline: '',
    teamMembers: [],
    checklist: []
  });

  tempTask = signal<string>('');

  private refreshInterval: any;

  ngOnInit() {
    const isSelf = this.router.url.includes('/employee/');
    this.isSelfPortal.set(isSelf);

    const data = localStorage.getItem('user_data');
    if (data) {
      this.currentUser.set(JSON.parse(data));
    }
    this.fetchData();
    this.setupRealtimeListeners();
    
    // Auto refresh as fallback every 60 seconds
    this.refreshInterval = setInterval(() => {
      this.fetchData(false);
    }, 60000);
  }

  setupRealtimeListeners() {
    // Listen for project updates (including task toggles)
    this.socketService.on('project-updated').subscribe((data: { project: Project }) => {
      const idx = this.projects().findIndex(p => p._id === data.project._id);
      if (idx !== -1) {
        const updatedProjects = [...this.projects()];
        updatedProjects[idx] = data.project;
        this.projects.set(updatedProjects);
      }
    });

    // Listen for new projects
    this.socketService.on('project-created').subscribe((data: { project: Project }) => {
      // Only add if I'm the manager or a team member
      const isManager = data.project.managerId === this.currentUser()?._id;
      const isMember = data.project.teamMembers.some((m: any) => m.memberId === this.currentUser()?._id);
      
      if (isManager || isMember) {
        this.projects.set([data.project, ...this.projects()]);
      }
    });

    // Listen for deletions
    this.socketService.on('project-deleted').subscribe((data: { projectId: string }) => {
      this.projects.set(this.projects().filter(p => p._id !== data.projectId));
    });
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  fetchData(showLoading = true) {
    if (showLoading) this.isLoading.set(true);
    const userId = this.currentUser()?._id || this.currentUser()?.employeeId;
    const isHr = this.userRole() === 'hr' || this.userRole() === 'hr_admin';

    if (this.isSelfPortal()) {
      this.apiService.getEmployeeProjects(userId).subscribe({
        next: (res: any) => {
          this.projects.set(res.projects || []);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to fetch employee projects', err);
          this.isLoading.set(false);
        }
      });
    } else {
      const projects$ = isHr ? this.apiService.getAllProjects() : this.apiService.getManagerProjects(userId);
      const team$ = isHr ? this.apiService.getGlobalTeam() : this.apiService.getManagerTeam(userId);

      forkJoin({
        projects: projects$,
        team: team$
      }).subscribe({
        next: (res: any) => {
          this.projects.set(res.projects.projects || []);
          
          // Combine interns and employees for member selection
          const members = [
            ...(res.team.interns || []).map((i: any) => ({ ...i, memberType: 'intern' })),
            ...(res.team.employees || []).map((e: any) => ({ ...e, memberType: 'employee' }))
          ];
          this.teamMembers.set(members);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to fetch project data', err);
          this.isLoading.set(false);
        }
      });
    }
  }

  openModal() {
    this.isEditMode.set(false);
    this.editingProjectId.set(null);
    this.resetForm();
    this.showAddModal.set(true);
  }

  toggleMenu(event: Event, projectId: string) {
    event.stopPropagation();
    if (this.activeMenuId() === projectId) {
      this.activeMenuId.set(null);
    } else {
      this.activeMenuId.set(projectId);
    }
  }

  editProject(project: Project) {
    this.activeMenuId.set(null);
    this.isEditMode.set(true);
    this.editingProjectId.set(project._id);
    this.newProject.set({
      title: project.title,
      client: project.client || '',
      description: project.description || '',
      deadline: project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : '',
      teamMembers: [...(project.teamMembers || [])],
      checklist: [...(project.checklist || [])]
    });
    this.showAddModal.set(true);
  }

  closeModal() {
    this.showAddModal.set(false);
  }

  resetForm() {
    this.newProject.set({
      title: '',
      client: '',
      description: '',
      deadline: '',
      teamMembers: [],
      checklist: []
    });
    this.tempTask.set('');
  }

  addMember(member: any) {
    const current = this.newProject();
    if (!current.teamMembers.find((m: any) => m.memberId === member._id)) {
      current.teamMembers.push({
        memberId: member._id,
        memberType: member.memberType,
        fullName: member.fullName
      });
      this.newProject.set({ ...current });
    }
  }

  removeMember(index: number) {
    const current = this.newProject();
    current.teamMembers.splice(index, 1);
    this.newProject.set({ ...current });
  }

  addTask() {
    if (!this.tempTask().trim()) return;
    const current = this.newProject();
    current.checklist.push({
      task: this.tempTask().trim(),
      isCompleted: false
    });
    this.newProject.set({ ...current });
    this.tempTask.set('');
  }

  removeTask(index: number) {
    const current = this.newProject();
    current.checklist.splice(index, 1);
    this.newProject.set({ ...current });
  }

  saveProject() {
    const projectData = this.newProject();
    if (!projectData.title) {
      this.alertService.show('Project title is required');
      return;
    }

    this.isLoading.set(true);
    const apiCall = this.isEditMode() 
      ? this.apiService.updateProject(this.editingProjectId()!, projectData)
      : this.apiService.createProject({ ...projectData, managerId: this.currentUser()?._id });

    apiCall.subscribe({
      next: () => {
        this.fetchData();
        this.closeModal();
      },
      error: (err) => {
        this.alertService.show('Failed to save project: ' + (err.error?.error || err.message));
        this.isLoading.set(false);
      }
    });
  }

  toggleTask(project: Project, task: ProjectTask) {
    if (!task._id) return;
    
    // Optimistic Update
    const projectIdx = this.projects().findIndex(p => p._id === project._id);
    if (projectIdx !== -1) {
      const updatedProjects = [...this.projects()];
      const updatedProject = { ...updatedProjects[projectIdx] };
      const taskIdx = updatedProject.checklist.findIndex(t => t._id === task._id);
      
      if (taskIdx !== -1) {
        updatedProject.checklist[taskIdx] = { 
          ...updatedProject.checklist[taskIdx], 
          isCompleted: !updatedProject.checklist[taskIdx].isCompleted 
        };
        
        // Recalculate progress locally
        const completedCount = updatedProject.checklist.filter(t => t.isCompleted).length;
        updatedProject.progress = Math.round((completedCount / updatedProject.checklist.length) * 100);
        
        updatedProjects[projectIdx] = updatedProject;
        this.projects.set(updatedProjects);
      }
    }

    this.apiService.toggleProjectTask(project._id, task._id, this.currentUser()?._id).subscribe({
      error: (err) => {
        // Rollback on error (simplified: just fetch full data)
        console.error('Toggle task failed, rolling back...', err);
        this.fetchData(false);
      }
    });
  }

  async deleteProject(projectId: string) {
    if (!await this.alertService.confirm('Are you sure you want to delete this project?')) return;
    
    // Optimistic Update
    const originalProjects = this.projects();
    this.projects.set(originalProjects.filter(p => p._id !== projectId));

    this.apiService.deleteProject(projectId).subscribe({
      error: (err) => {
        // Rollback on error
        this.alertService.show('Failed to delete project');
        this.projects.set(originalProjects);
      }
    });
  }

  getProgressColor(progress: number): string {
    if (progress < 30) return '#ef4444';
    if (progress < 70) return '#f59e0b';
    return '#10b981';
  }
}
