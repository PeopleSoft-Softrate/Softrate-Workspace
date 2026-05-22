import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { App } from '../../../app';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrl: '../login/login.css'
})
export class Register {
  private apiService = inject(ApiService);
  private router = inject(Router);
  private app = inject(App);

  isLoading = signal(false);
  errorMessage = signal('');

  formData = {
    companyName: '',
    companyCode: '',
    hrName: '',
    hrEmail: '',
    hrPassword: ''
  };

  onSubmit() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.apiService.registerCompany(this.formData).subscribe({
      next: (res) => {
        if (res.success) {
          // Log the user in directly
          localStorage.setItem('user_role', 'hr');
          localStorage.setItem('user_data', JSON.stringify(res.hr));
          if (res.token) localStorage.setItem('auth_token', res.token);
          this.app.userRole.set('hr');
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage.set(res.msg || 'Registration failed');
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        this.errorMessage.set(err.error?.msg || 'Registration failed due to a server error.');
        this.isLoading.set(false);
      }
    });
  }
}
