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
      this.editingTemplate.set({ ...current });
    }
  }

  removeGoal(index: number) {
    const current = this.editingTemplate();
    if (current) {
      current.goals.splice(index, 1);
      this.editingTemplate.set({ ...current });
    }
  }

  save() {
    const current = this.editingTemplate();
    if (current) {
      this.apiService.savePerformanceTemplate(current).subscribe({
        next: () => {
          this.editingTemplate.set(null);
          this.loadTemplates();
        },
        error: (err) => alert(err.error?.message || 'Save failed')
      });
    }
  }

  deleteTemplate(id: string) {
    if (confirm('Are you sure you want to delete this template?')) {
      this.apiService.deletePerformanceTemplate(id).subscribe({
        next: () => this.loadTemplates()
      });
    }
  }

  cancel() {
    this.editingTemplate.set(null);
  }
}
