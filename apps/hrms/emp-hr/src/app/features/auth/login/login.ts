import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { App } from '../../../app';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private apiService = inject(ApiService);
  private router = inject(Router);
  private app = inject(App);

  isLoading = signal(false);
  errorMessage = signal('');

  credentials = {
    identifier: '',
    password: ''
  };

  onSubmit() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.apiService.login(this.credentials.identifier, this.credentials.password).subscribe({
      next: (res) => {
        // Use the role returned by unified-login
        const actualRole = res.role;
        const userData = res.user || res.employee || res.hr;
        
        // Ensure name is present for the greeting
        if (userData && !userData.profile && userData.firstName) {
          userData.profile = { firstName: userData.firstName };
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
}
