import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { App } from '../../../app';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HugeiconsIconComponent],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  private apiService = inject(ApiService);
  private router = inject(Router);
  private app = inject(App);

  isLoading = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);

  ngOnInit() {
    const token = localStorage.getItem('auth_token');
    const role = localStorage.getItem('user_role');
    
    if (token && role) {
      if (role === 'hr' || role === 'hr_admin') {
        this.router.navigate(['/dashboard']);
      } else if (role === 'employee' || role === 'manager') {
        this.router.navigate(['/employee/dashboard']);
      }
    }
  }

  requiresPasswordReset = signal(false);
  resetUserId = '';
  newPassword = '';
  confirmPassword = '';

  ViewIcon = ViewIcon;
  ViewOffIcon = ViewOffIcon;

  credentials = {
    companyCode: '',
    identifier: '',
    password: ''
  };

  onSubmit() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.apiService.login(this.credentials.companyCode, this.credentials.identifier, this.credentials.password).subscribe({
      next: (res) => {
        // Use the role returned by unified-login
        const actualRole = res.role;
        const userData = res.user || res.employee || res.hr;
        
        // Ensure name is present for the greeting
        if (userData && !userData.profile && userData.firstName) {
          userData.profile = { firstName: userData.firstName };
        }

        if (res.forcePasswordReset) {
          this.requiresPasswordReset.set(true);
          this.resetUserId = userData._id;
          if (res.token) localStorage.setItem('auth_token', res.token);
          this.isLoading.set(false);
          return;
        }

        localStorage.setItem('user_role', actualRole);
        localStorage.setItem('user_data', JSON.stringify(userData));
        if (res.token) localStorage.setItem('auth_token', res.token);
        
        this.app.userRole.set(actualRole);
        this.app.loadUserData();

        if (actualRole === 'hr' || actualRole === 'hr_admin') {
          this.router.navigate(['/dashboard']);
        } else if (actualRole === 'employee' || actualRole === 'manager') {
          this.router.navigate(['/employee/dashboard']);
        } else {
          this.errorMessage.set('Unauthorized role for this portal');
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Login failed');
        this.isLoading.set(false);
      }
    });
  }

  isPasswordValid(password: string): boolean {
    if (password.length < 8) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
    return true;
  }

  onResetSubmit() {
    if (!this.newPassword || !this.confirmPassword) {
      this.errorMessage.set('Please fill in both fields.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }
    if (!this.isPasswordValid(this.newPassword)) {
      this.errorMessage.set('Password must be at least 8 chars, 1 uppercase, 1 symbol.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.apiService.forceResetPassword(this.resetUserId, this.newPassword).subscribe({
      next: (res: any) => {
        // Clear token and ask to re-login with new password
        localStorage.removeItem('auth_token');
        this.requiresPasswordReset.set(false);
        this.isLoading.set(false);
        this.credentials.password = '';
        this.newPassword = '';
        this.confirmPassword = '';
        // Optionally show a success toast here
      },
      error: (err: any) => {
        this.errorMessage.set(err.error?.message || 'Failed to update password');
        this.isLoading.set(false);
      }
    });
  }
}
