import { AlertService } from '../../../shared/services/alert';
import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api.service';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-employee-add',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './employee-add.html',
  styleUrl: './employee-add.css'
})
export class EmployeeAdd implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  
  isSaving = signal(false);
  isApprovalMode = signal(false);
  isEditMode = signal(false);
  requestId = '';
  
  employee = {
    fullName: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
    onboardingDate: '',
    address: '',
    role: 'Employee',
    qualification: '',
    specialization: '',
    college: '',
    passingYear: '',
    ugCgpa: '',
    pgCgpa: '',
    isExperienced: false,
    experienceYears: '',
    previousOrg: '',
    gender: '',
    nationality: '',
    maritalStatus: '',
    dob: '',
    linkedin: '',
    emergencyName: '',
    emergencyPhone: '',
    isRemote: false
  };

  employeeRoles = signal<string[]>([]);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const isEdit = this.route.snapshot.queryParamMap.get('edit') === 'true';

    if (id) {
      if (isEdit) {
        this.isEditMode.set(true);
      } else {
        this.isApprovalMode.set(true);
      }
      this.requestId = id;
      this.fetchRequestData(id);
    }
    this.fetchSettings();
  }

  fetchSettings() {
    this.apiService.getCompanySettings().subscribe({
      next: (res: any) => {
        if (res.success && res.settings) {
          const fetchedRoles = res.settings.employeeRoles || [];
          const currentRoles = this.employeeRoles();
          const mergedRoles = Array.from(new Set([...fetchedRoles, ...currentRoles]));
          this.employeeRoles.set(mergedRoles);
        }
      },
      error: (err) => console.error('Failed to fetch settings', err)
    });
  }

  fetchRequestData(id: string) {
    this.apiService.getEmployeeById(id).subscribe({
      next: (data) => {
        console.log('Fetched employee data:', data);
        this.employee = {
          ...this.employee,
          ...data,
          // Handle potential date format issues
          dob: data.dob ? new Date(data.dob).toISOString().split('T')[0] : '',
          onboardingDate: data.onboardingDate ? new Date(data.onboardingDate).toISOString().split('T')[0] : '',
          designation: data.designation || data.role || '',
          isRemote: data.isRemote || false
        };
        
        // Ensure the designation exists in the dropdown options if it came from the DB
        if (this.employee.designation) {
          const currentRoles = this.employeeRoles();
          if (!currentRoles.includes(this.employee.designation)) {
            this.employeeRoles.set([...currentRoles, this.employee.designation]);
          }
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to fetch request data', err);
        this.alertService.show('Failed to load application data');
      }
    });
  }

  saveEmployee() {
    if (!this.employee.fullName || !this.employee.email || !this.employee.onboardingDate || !this.employee.department || !this.employee.designation) {
      this.alertService.show('Please fill all required fields including Department, Designation, and Onboarding Date');
      return;
    }

    this.isSaving.set(true);

    if (this.isEditMode()) {
      this.apiService.updateEmployee(this.requestId, this.employee).subscribe({
        next: () => {
          this.alertService.show('Employee profile updated successfully!');
          this.router.navigate(['/employees', this.requestId]);
        },
        error: (err: any) => {
          console.error('Failed to update employee', err);
          this.alertService.show('Failed to update: ' + (err.error?.message || err.message));
          this.isSaving.set(false);
        }
      });
    } else if (this.isApprovalMode()) {
      this.apiService.acceptEmployee(this.requestId, this.employee).subscribe({
        next: () => {
          this.alertService.show('Employee onboarding started!');
          this.router.navigate(['/employees/requests']);
        },
        error: (err: any) => {
          console.error('Failed to approve employee', err);
          this.alertService.show('Failed to approve: ' + (err.error?.message || err.message));
          this.isSaving.set(false);
        }
      });
    } else {
      this.apiService.addEmployee(this.employee).subscribe({
        next: () => {
          this.alertService.show('Employee added successfully');
          this.router.navigate(['/employees']);
        },
        error: (err: any) => {
          console.error('Failed to add employee', err);
          this.alertService.show('Failed to add: ' + (err.error?.message || err.message));
          this.isSaving.set(false);
        }
      });
    }
  }
}
