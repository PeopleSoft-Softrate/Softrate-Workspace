import { AlertService } from '../../shared/services/alert';
import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../services/api.service';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { WorkflowSquare03Icon, Mail01Icon, Settings01Icon, SmartPhone02Icon } from '@hugeicons/core-free-icons';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-org-hierarchy',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HugeiconsIconComponent],
  templateUrl: './org-hierarchy.html',
  styleUrl: './org-hierarchy.css'
})
export class OrgHierarchy implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);

  readonly WorkflowSquare03Icon = WorkflowSquare03Icon;
  readonly Mail01Icon = Mail01Icon;
  readonly Settings01Icon = Settings01Icon;
  readonly SmartPhone02Icon = SmartPhone02Icon;
  
  hierarchyUrl: string = '';
  publishedUrl = signal('');
  
  userEmail: string = '';
  isLoading = signal(true);
  isSaving = signal(false);
  isSelfPortal = signal<boolean>(false);

  ngOnInit() {
    const isSelf = this.router.url.includes('/employee/');
    this.isSelfPortal.set(isSelf);

    const rawData = localStorage.getItem('user_data');
    let userData: any = {};
    if (rawData && rawData !== 'undefined') {
      try {
        userData = JSON.parse(rawData);
      } catch (e) {
        console.error('Failed to parse user_data', e);
      }
    }
    this.userEmail = userData.email || 'admin@gmail.com';
    this.fetchHierarchy();
  }

  fetchHierarchy() {
    this.isLoading.set(true);
    this.apiService.getOrgHierarchy().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (data: any) => {
        if (data.success && data.policy_url) {
          this.hierarchyUrl = data.policy_url;
          this.publishedUrl.set(data.policy_url);
        } else {
          this.fetchGlobalHierarchy();
        }
      },
      error: () => this.fetchGlobalHierarchy()
    });
  }

  fetchGlobalHierarchy() {
    this.isLoading.set(true);
    this.apiService.getGlobalPolicyUrl().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (data: any) => {
        if (data.success && data.policy_url) {
          this.hierarchyUrl = data.policy_url;
          this.publishedUrl.set(data.policy_url);
        }
      },
      error: (err: any) => {
        console.error('Failed to fetch global hierarchy', err);
      }
    });
  }

  saveHierarchy() {
    if (!this.hierarchyUrl) {
      this.alertService.show('Please enter a URL');
      return;
    }

    this.isSaving.set(true);
    this.apiService.saveOrgHierarchy(this.hierarchyUrl).pipe(
      finalize(() => this.isSaving.set(false))
    ).subscribe({
      next: () => {
        this.publishedUrl.set(this.hierarchyUrl);
      },
      error: (err: any) => {
        this.alertService.show('Failed to save: ' + (err.error?.msg || err.message));
      }
    });
  }

  viewHierarchy() {
    if (this.publishedUrl()) {
      window.open(this.publishedUrl(), '_blank');
    }
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
