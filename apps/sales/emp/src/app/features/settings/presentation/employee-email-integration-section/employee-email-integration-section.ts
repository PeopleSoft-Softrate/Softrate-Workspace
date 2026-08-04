import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../api.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-employee-email-integration-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './employee-email-integration-section.html',
  styleUrls: ['./employee-email-integration-section.css']
})
export class EmployeeEmailIntegrationSectionComponent implements OnInit {
  vm = {
    loading: false,
    errorMessage: '',
    emailIntegrationStatus: {
      connected: false,
      provider: '',
      email: '',
      connectedAt: ''
    },
    clearError: () => {
      this.vm.errorMessage = '';
    }
  };

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.checkOAuthCallback();
    this.fetchEmailStatus();
  }

  private checkOAuthCallback() {
    this.route.queryParams.subscribe(params => {
      if (params['oauth'] === 'success') {
        // Clear query params
        this.router.navigate([], {
          queryParams: { oauth: null, msg: null },
          queryParamsHandling: 'merge'
        });
        setTimeout(() => this.fetchEmailStatus(), 500);
      } else if (params['oauth'] === 'error') {
        this.vm.errorMessage = 'Google authentication failed: ' + (params['msg'] || params['reason'] || 'Unknown error');
        this.router.navigate([], {
          queryParams: { oauth: null, msg: null, reason: null },
          queryParamsHandling: 'merge'
        });
      }
    });
  }

  fetchEmailStatus() {
    this.vm.loading = true;
    this.api.get<any>('/api/email/status').subscribe({
      next: (res) => {
        if (res.success) {
          this.vm.emailIntegrationStatus = {
            connected: res.connected,
            provider: res.provider,
            email: res.email,
            connectedAt: res.connectedAt
          };
        }
        this.vm.loading = false;
      },
      error: (err) => {
        console.error('Failed to fetch email status', err);
        this.vm.loading = false;
      }
    });
  }

  connectGoogle() {
    this.vm.loading = true;
    this.vm.errorMessage = '';
    
    this.api.get<any>('/api/email/google/connect').subscribe({
      next: (res) => {
        if (res.success && res.authUrl) {
          // Redirect the employee to Google's OAuth consent screen
          window.location.href = res.authUrl;
        } else {
          this.vm.errorMessage = 'Failed to generate connection URL.';
          this.vm.loading = false;
        }
      },
      error: (err) => {
        console.error('Connect error:', err);
        this.vm.errorMessage = err.error?.message || 'Failed to initiate Google connection.';
        this.vm.loading = false;
      }
    });
  }

  disconnectGoogle() {
    if (!confirm('Are you sure you want to disconnect your Google Workspace account? You will not be able to send emails until you reconnect.')) {
      return;
    }

    this.vm.loading = true;
    this.vm.errorMessage = '';

    this.api.post<any>('/api/email/disconnect', { provider: 'google' }).subscribe({
      next: (res) => {
        if (res.success) {
          this.fetchEmailStatus();
        } else {
          this.vm.errorMessage = res.message || 'Failed to disconnect.';
          this.vm.loading = false;
        }
      },
      error: (err) => {
        console.error('Disconnect error:', err);
        this.vm.errorMessage = err.error?.message || 'Failed to disconnect.';
        this.vm.loading = false;
      }
    });
  }
}
