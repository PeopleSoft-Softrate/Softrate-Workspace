import { AlertService } from '../../shared/services/alert';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

interface Goal {
  perspective: string;
  kpiName: string;
  title: string;
  description: string;
  weight: number;
}

interface Template {
  _id?: string;
  roleName: string;
  category: string;
  goals: Goal[];
}

@Component({
  selector: 'app-performance-goals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './performance-goals.html',
  styleUrl: './performance-goals.css'
})
export class PerformanceGoals implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);

  templates = signal<Template[]>([]);
  isLoading = signal(false);
  
  editingTemplate = signal<Template | null>(null);
  
  // Collect unique perspectives from all templates for suggestions
  existingPerspectives = signal<string[]>([]);

  ngOnInit() {
    this.loadTemplates();
  }

  loadTemplates() {
    this.isLoading.set(true);
    this.apiService.getPerformanceTemplates().subscribe({
      next: (res) => {
        this.templates.set(res);
        this.updatePerspectives(res);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  updatePerspectives(templates: Template[]) {
    const pSet = new Set<string>();
    templates.forEach(t => t.goals.forEach(g => {
      if (g.perspective) pSet.add(g.perspective);
    }));
    this.existingPerspectives.set(Array.from(pSet));
  }

  createNew() {
    this.editingTemplate.set({
      roleName: '',
      category: '',
      goals: []
    });
  }

  editTemplate(t: Template) {
    this.editingTemplate.set(JSON.parse(JSON.stringify(t)));
  }

  addGoal() {
    const current = this.editingTemplate();
    if (current) {
      current.goals.push({
        perspective: 'Quality Perspective',
        kpiName: '',
        title: '',
        description: '',
        weight: 0
      });
      this.editingTemplate.set({ ...current, goals: [...current.goals] });
    }
  }

  removeGoal(index: number) {
    const current = this.editingTemplate();
    if (current) {
      const goals = [...current.goals];
      goals.splice(index, 1);
      this.editingTemplate.set({ ...current, goals });
    }
  }

  updateGoal(index: number, field: keyof Goal, value: any) {
    const current = this.editingTemplate();
    if (current) {
      const goals = [...current.goals];
      goals[index] = { ...goals[index], [field]: field === 'weight' ? Number(value) : value };
      this.editingTemplate.set({ ...current, goals });
    }
  }

  save() {
    const current = this.editingTemplate();
    if (!current) return;

    if (!current.roleName?.trim() || !current.category?.trim()) {
      this.alertService.show('Please fill in Role Name and Category.');
      return;
    }

    if (current.goals.length === 0) {
      this.alertService.show('Please add at least one goal.');
      return;
    }

    for (let i = 0; i < current.goals.length; i++) {
      const g = current.goals[i];
      if (!g.perspective?.trim() || !g.kpiName?.trim() || !g.title?.trim() || !g.description?.trim()) {
        this.alertService.show(`Goal #${i + 1}: Please fill in all required fields (Perspective, KPI Name, Title, Description).`);
        return;
      }
      if (!g.weight || g.weight <= 0) {
        this.alertService.show(`Goal #${i + 1}: Weight must be greater than 0.`);
        return;
      }
    }

    this.apiService.savePerformanceTemplate(current).subscribe({
      next: () => {
        this.editingTemplate.set(null);
        this.loadTemplates();
      },
      error: (err) => this.alertService.show(err.error?.message || 'Save failed')
    });
  }


  async deleteTemplate(id: string) {
    if (await this.alertService.confirm('Are you sure you want to delete this template?')) {
      this.apiService.deletePerformanceTemplate(id).subscribe({
        next: () => this.loadTemplates()
      });
    }
  }

  cancel() {
    this.editingTemplate.set(null);
  }
}
