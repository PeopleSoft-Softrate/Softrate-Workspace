import { AlertService } from '../../shared/services/alert';
import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../services/api.service';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { AddInvoiceIcon, PolicyIcon, CheckmarkCircle01Icon, ViewIcon, Delete02Icon } from '@hugeicons/core-free-icons';
import { TourService } from '../../services/tour.service';

@Component({
  selector: 'app-hr-policies',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HugeiconsIconComponent],
  templateUrl: './hr-policies.html',
  styleUrl: './hr-policies.css'
})
export class HrPolicies implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);
  private tourService = inject(TourService);

  readonly AddInvoiceIcon = AddInvoiceIcon;
  readonly PolicyIcon = PolicyIcon;
  readonly CheckmarkCircle01Icon = CheckmarkCircle01Icon;
  readonly ViewIcon = ViewIcon;
  readonly Delete02Icon = Delete02Icon;
  
  policies = signal<any[]>([]);
  isLoading = signal(true);
  isSaving = signal(false);
  isSelfPortal = signal<boolean>(false);
  
  searchQuery = signal<string>('');
  selectedPolicyUrl = signal<string>('');
  selectedPolicyName = signal<string>('');
  
  newPolicy = {
    policy_name: '',
    policy_url: '',
    policy_view_by: ['employee', 'intern']
  };

  ngOnInit() {
    const isSelf = this.router.url.includes('/employee/') || this.router.url.includes('/intern/');
    this.isSelfPortal.set(isSelf);
    this.fetchPolicies();

    setTimeout(() => {
      if (!this.isSelfPortal()) {
        this.tourService.startHrPolicyTour();
      }
    }, 800);
  }

  fetchPolicies(isRefresh = false) {
    if (!isRefresh) this.isLoading.set(true);
    this.apiService.getPolicies().subscribe({
      next: (data: any[]) => {
        let displayData = data;
        const url = this.router.url;
        if (url.includes('/employee/')) {
          displayData = data.filter(p => p.policy_view_by && p.policy_view_by.map((r: string) => r.toLowerCase()).includes('employee'));
        } else if (url.includes('/intern/')) {
          displayData = data.filter(p => p.policy_view_by && p.policy_view_by.map((r: string) => r.toLowerCase()).includes('intern'));
        }
        
        this.policies.set(displayData);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        console.error('Failed to fetch policies', err);
        this.isLoading.set(false);
      }
    });
  }

  get filteredPolicies() {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.policies();
    return this.policies().filter(p => 
      p.policy_name.toLowerCase().includes(query)
    );
  }

  addPolicy() {
    if (!this.newPolicy.policy_name || !this.newPolicy.policy_url) {
      this.alertService.show('Please fill name and URL');
      return;
    }

    this.isSaving.set(true);
    this.apiService.savePolicy(this.newPolicy).subscribe({
      next: () => {
        this.fetchPolicies(true); // Silent refresh
        this.newPolicy = { policy_name: '', policy_url: '', policy_view_by: ['employee', 'intern'] };
        this.isSaving.set(false);
      },
      error: (err: any) => {
        this.alertService.show('Failed to save: ' + err.message);
        this.isSaving.set(false);
      }
    });
  }

  toggleVisibility(role: string) {
    const current = this.newPolicy.policy_view_by;
    if (current.includes(role)) {
      this.newPolicy.policy_view_by = current.filter(r => r !== role);
    } else {
      this.newPolicy.policy_view_by = [...current, role];
    }
  }

  isRoleSelected(role: string): boolean {
    return this.newPolicy.policy_view_by.includes(role);
  }

  async deletePolicy(id: string) {
    if (await this.alertService.confirm('Delete this policy?')) {
      this.apiService.deletePolicy(id).subscribe({
        next: () => {
          this.fetchPolicies(true); // Silent refresh
        },
        error: (err: any) => this.alertService.show('Failed to delete: ' + err.message)
      });
    }
  }

  openPdf(url: string) {
    window.open(url, '_blank');
  }

  selectPolicy(policy: any) {
    this.selectedPolicyUrl.set(policy.policy_url);
    this.selectedPolicyName.set(policy.policy_name);
  }

  closeReader() {
    this.selectedPolicyUrl.set('');
    this.selectedPolicyName.set('');
  }

  getSafeUrl(url: string): SafeResourceUrl {
    if (!url) return '';
    let processedUrl = url;

    // Convert Google Drive view URLs to preview/embed URLs
    if (url.includes('drive.google.com')) {
      if (url.includes('/view')) {
        processedUrl = url.replace('/view', '/preview');
      } else if (url.includes('open?id=')) {
        processedUrl = url.replace('open?id=', 'file/d/') + '/preview';
      }
    }
    // Convert Dropbox URLs to direct/embed URLs
    else if (url.includes('dropbox.com')) {
      processedUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
      if (processedUrl.includes('?dl=0')) {
        processedUrl = processedUrl.replace('?dl=0', '');
      }
      if (!processedUrl.includes('?raw=1') && !processedUrl.includes('&raw=1')) {
        processedUrl += '?raw=1';
      }
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(processedUrl);
  }
}
