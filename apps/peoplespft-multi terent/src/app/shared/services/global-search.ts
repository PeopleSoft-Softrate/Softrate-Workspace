import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { forkJoin } from 'rxjs';

export interface SearchResult {
  id: string;
  type: 'employee' | 'intern';
  name: string;
  subtitle: string;
  initials: string;
  route: string;
}

@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
  private apiService = inject(ApiService);

  private employees: any[] = [];
  private interns: any[] = [];
  private loaded = false;

  results = signal<SearchResult[]>([]);
  isLoading = signal(false);

  preload() {
    if (this.loaded) return;
    this.isLoading.set(true);
    forkJoin({
      employees: this.apiService.getAllEmployees(),
      interns: this.apiService.getAllActiveInterns()
    }).subscribe({
      next: (data) => {
        this.employees = data.employees || [];
        this.interns = data.interns || [];
        this.loaded = true;
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  search(query: string) {
    if (!query.trim()) {
      this.results.set([]);
      return;
    }

    const q = query.toLowerCase();

    const empResults: SearchResult[] = this.employees
      .filter(e =>
        e.fullName?.toLowerCase().includes(q) ||
        e.EmployeeId?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q) ||
        e.role?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map(e => ({
        id: e._id,
        type: 'employee',
        name: e.fullName,
        subtitle: `${e.EmployeeId || ''} · ${e.role || e.department || 'Employee'}`,
        initials: this.getInitials(e.fullName),
        route: `/employees/${e._id}`
      }));

    const internResults: SearchResult[] = this.interns
      .filter(i =>
        i.fullName?.toLowerCase().includes(q) ||
        i.internid?.toLowerCase().includes(q) ||
        i.internId?.toLowerCase().includes(q) ||
        i.department?.toLowerCase().includes(q) ||
        i.role?.toLowerCase().includes(q) ||
        i.email?.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map(i => ({
        id: i._id,
        type: 'intern',
        name: i.fullName,
        subtitle: `${i.internid || i.internId || ''} · ${i.role || i.department || 'Intern'}`,
        initials: this.getInitials(i.fullName),
        route: `/interns/${i._id}`
      }));

    this.results.set([...empResults, ...internResults]);
  }

  clear() {
    this.results.set([]);
  }

  private getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
