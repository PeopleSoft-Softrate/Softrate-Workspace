import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-user-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './user-register.html',
  styleUrl: './user-register.css'
})
export class UserRegister {
  private apiService = inject(ApiService);
  private router = inject(Router);

  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  // Step 1: Verification
  currentStep = 1; // 1: Verify, 2: Role, 3: Form
  isVerifying = signal(false);
  isVerified = signal(false);
  verifiedCompanyName = signal('');
  companyCode = '';
  companySettings: any = null;

  // Walk-in Drives
  isLoadingDrives = signal(false);
  walkinDrives = signal<any[]>([]);
  selectedWalkinDriveId: string | null = null;

  // Form Data
  applicationType = 'Internship'; // Internship | Employee | Walkin
  fullName = '';
  email = '';
  phone = '';
  college = '';
  department = '';
  year = '';
  role = '';
  otherRole = '';
  emergencyContact = '';
  linkedin = '';
  resumeBase64: string | null = null;
  resumeFileName: string | null = null;

  // Employee-only fields (matches employee_formone.dart)
  emergencyName = '';
  dob = '';
  address = '';
  gender = '';
  nationality = '';
  maritalStatus = '';

  // Dropdown options
  genders = ['Male', 'Female', 'Other'];
  maritalOptions = ['Single', 'Married', 'Other'];
  
  // Project Links (up to 5)
  projectLinks: string[] = [''];

  trackByIndex(index: number, obj: any): any {
    return index;
  }

  years = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Passed Out'];
  roles: string[] = ['Other'];

  // Declarations
  declareAccuracy = false;
  bgConsent = false;
  whatsappConsent = false;
  showDeclarationModal = false;

  addProjectLink() {
    if (this.projectLinks.length < 5) {
      this.projectLinks.push('');
    }
  }

  removeProjectLink(index: number) {
    if (this.projectLinks.length > 1) {
      this.projectLinks.splice(index, 1);
    }
  }

  onFileChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        this.errorMessage.set('PDF size must be less than 2MB');
        return;
      }
      this.resumeFileName = file.name;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const base64Str = e.target.result.split(',')[1];
        this.resumeBase64 = base64Str;
      };
      reader.readAsDataURL(file);
    }
  }

  formatWalkinEndDate(endDate: any): string {
    if (!endDate) return '';
    return endDate.toString().substring(0, 10);
  }

  selectWalkinDrive(drive: any) {
    this.applicationType = 'Walkin';
    this.selectedWalkinDriveId = drive._id || drive.id || 'walkin';
    this.onApplicationTypeChange();
  }

  selectRoleType(type: string) {
    this.applicationType = type;
    this.selectedWalkinDriveId = null;
    this.onApplicationTypeChange();
  }

  fetchWalkinDrives(code: string) {
    this.isLoadingDrives.set(true);
    this.walkinDrives.set([]);
    this.apiService.getPublicWalkinDrives(code).subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) {
          this.walkinDrives.set(res);
        }
        this.isLoadingDrives.set(false);
      },
      error: () => {
        this.isLoadingDrives.set(false);
      }
    });
  }

  onApplicationTypeChange() {
    this.roles = ['Other'];
    this.role = '';
    let fetchedRoles: string[] = [];
    if (this.companySettings) {
      if (this.applicationType === 'Internship' || this.applicationType === 'Walkin') {
        fetchedRoles = this.companySettings.internRoles || [];
      } else {
        fetchedRoles = this.companySettings.employeeRoles || [];
      }
    }
    if (fetchedRoles.length > 0) {
      this.roles = fetchedRoles.map((e: any) => {
        const word = e.toString().toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1);
      });
    }
    if (!this.roles.includes('Other')) {
      this.roles.push('Other');
    }
  }

  verifyCompany() {
    if (!this.companyCode) {
      this.errorMessage.set('Please enter a company code');
      return;
    }

    this.isVerifying.set(true);
    this.errorMessage.set('');

    this.apiService.verifyCompany(this.companyCode).subscribe({
      next: (res: any) => {
        if (res && res.company) {
          this.isVerified.set(true);
          this.verifiedCompanyName.set(res.company.name);
          this.companySettings = res.company.settings || null;
          this.currentStep = 2; // Go to step 2

          this.onApplicationTypeChange();
          this.fetchWalkinDrives(this.companyCode);
        }
        this.isVerifying.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.msg || 'Invalid Company Code');
        this.isVerifying.set(false);
      }
    });
  }

  openDeclaration() {
    this.errorMessage.set('');
    if (!this.declareAccuracy || !this.bgConsent || !this.whatsappConsent) {
      this.errorMessage.set('Please accept all declarations in the form first.');
      return;
    }
    this.showDeclarationModal = true;
  }

  closeDeclaration() {
    this.showDeclarationModal = false;
  }

  nextStep() {
    if (this.currentStep === 2 && this.applicationType) {
       this.currentStep = 3;
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
       this.currentStep--;
    }
  }

  submitForm() {
    this.closeDeclaration();
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const finalRole = this.role === 'Other' ? this.otherRole : this.role;
    const validProjectLinks = this.projectLinks.filter(l => l.trim().length > 0);

    const basePayload: any = {
      companyCode: this.companyCode.toUpperCase(),
      fullName: this.fullName,
      email: this.email,
      contact: this.phone,
      phone: this.phone,
      linkedin: this.linkedin,
      role: finalRole,
      projectLinks: JSON.stringify(validProjectLinks),
      declaration: this.declareAccuracy.toString(),
      bgConsent: this.bgConsent.toString(),
      whatsappConsent: this.whatsappConsent.toString()
    };

    if (this.applicationType === 'Internship' || this.applicationType === 'Walkin') {
      // Matches form_one.dart
      basePayload.college = this.college;
      basePayload.department = this.department;
      basePayload.year = this.year;
      basePayload.applicationType = this.applicationType;
      basePayload.resume = this.resumeBase64;
      basePayload.emergencyContact = this.emergencyContact;
      basePayload.emergencyPhone = this.emergencyContact;
      if (this.applicationType === 'Walkin' && this.selectedWalkinDriveId) {
        basePayload.walkinDriveId = this.selectedWalkinDriveId;
      }
    }

    if (this.applicationType === 'Employee') {
      // Matches employee_formone.dart
      basePayload.emergencyName = this.emergencyName;
      basePayload.emergencyContact = this.emergencyContact;
      basePayload.emergencyPhone = this.emergencyContact;
      basePayload.dob = this.dob;
      basePayload.address = this.address;
      basePayload.gender = this.gender;
      basePayload.nationality = this.nationality;
      basePayload.maritalStatus = this.maritalStatus;
    }

    let apiCall;
    if (this.applicationType === 'Walkin') {
      apiCall = this.apiService.walkinApply(basePayload);
    } else if (this.applicationType === 'Employee') {
      apiCall = this.apiService.addEmployee(basePayload);
    } else {
      apiCall = this.apiService.addIntern(basePayload);
    }

    apiCall.subscribe({
      next: (res: any) => {
        this.isLoading.set(false);
        this.successMessage.set('Application submitted successfully!');
        
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || err.error?.msg || 'Submission failed');
        this.isLoading.set(false);
      }
    });
  }
}
