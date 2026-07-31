import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { AlertService } from '../../../shared/services/alert';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { 
  LicenseDraftIcon,
  Mortarboard02Icon,
  File02Icon,
  Shield02Icon,
  Wallet01Icon,
  Upload04Icon,
  TaskDone01Icon,
  Delete01Icon,
  Notification03Icon,
  UserCircleIcon
} from '@hugeicons/core-free-icons';

interface DocFile {
  key: string;
  title: string;
  subtitle: string;
  icon: any;
  file: File | null;
  error: boolean;
  status: 'idle' | 'success' | 'error';
  required: boolean;
}

@Component({
  selector: 'app-intern-form-two',
  standalone: true,
  imports: [CommonModule, RouterModule, HugeiconsIconComponent],
  templateUrl: './intern-form-two.html',
  styleUrl: './intern-form-two.css'
})
export class InternFormTwo implements OnInit {
  private apiService = inject(ApiService);
  private alertService = inject(AlertService);
  private router = inject(Router);

  LicenseDraftIcon = LicenseDraftIcon;
  Mortarboard02Icon = Mortarboard02Icon;
  File02Icon = File02Icon;
  Shield02Icon = Shield02Icon;
  Wallet01Icon = Wallet01Icon;
  Upload04Icon = Upload04Icon;
  TaskDone01Icon = TaskDone01Icon;
  Delete01Icon = Delete01Icon;
  Notification03Icon = Notification03Icon;
  UserCircleIcon = UserCircleIcon;

  internName = signal<string>('');
  internId = signal<string>('');

  isUploading = signal(false);
  uploadProgress = signal(0);

  // Consent checkboxes
  consentGiven = signal(false);
  infoAccurate = signal(false);
  consentBgVerification = signal(false);
  agreeCommunication = signal(false);

  docs = signal<DocFile[]>([
    { key: 'aadhaar',  title: 'Aadhaar Card',         subtitle: '• Max 2 MB', icon: LicenseDraftIcon, file: null, error: false, status: 'idle', required: true },
    { key: 'college',  title: 'College ID / Bonafide', subtitle: '• Max 2 MB', icon: Mortarboard02Icon, file: null, error: false, status: 'idle', required: true },
    { key: 'annexure', title: 'Internship Annexure',   subtitle: '• Max 2 MB', icon: File02Icon, file: null, error: false, status: 'idle', required: true },
    { key: 'nda',      title: 'Internship NDA',        subtitle: '• Max 2 MB', icon: Shield02Icon, file: null, error: false, status: 'idle', required: true },
    { key: 'passbook', title: 'Bank Passbook',         subtitle: '• Max 2 MB', icon: Wallet01Icon, file: null, error: false, status: 'idle', required: false },
  ]);

  ngOnInit() {
    const data = localStorage.getItem('user_data');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        this.internName.set(parsed.fullName || parsed.name || 'Intern');
        this.internId.set(parsed.internid || parsed.EmployeeId || parsed._id || '');
      } catch (e) {
        console.warn('Error reading user_data:', e);
      }
    }
  }

  pickFile(key: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.pdf')) {
        this.alertService.show('Only PDF files are allowed.');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        this.alertService.show('File must be less than 2 MB.');
        return;
      }

      // Check for duplicate filenames across other slots
      const isDuplicate = this.docs().some(d => d.key !== key && d.file?.name === file.name);
      if (isDuplicate) {
        this.alertService.show('This file is already selected for another field. Please upload a relevant file.');
        return;
      }

      this.docs.update(docs => docs.map(d =>
        d.key === key ? { ...d, file, error: false, status: 'idle' } : d
      ));
    };
    input.click();
  }

  removeFile(key: string) {
    this.docs.update(docs => docs.map(d =>
      d.key === key ? { ...d, file: null, error: false, status: 'idle' } : d
    ));
  }

  allConsentsGiven(): boolean {
    return this.consentGiven() && this.infoAccurate() && this.consentBgVerification() && this.agreeCommunication();
  }

  async uploadAll() {
    if (!this.allConsentsGiven()) {
      this.alertService.show('Please agree to all declarations and consents before uploading.');
      return;
    }

    const missing = this.docs().filter(d => d.required && !d.file);
    if (missing.length > 0) {
      this.docs.update(docs => docs.map(d => ({ ...d, error: d.required && !d.file })));
      this.alertService.show('Please upload all required documents.');
      return;
    }

    if (!this.internId()) {
      this.alertService.show('Intern ID not found. Please login again.');
      return;
    }

    this.isUploading.set(true);
    this.uploadProgress.set(0);

    const formData = new FormData();
    formData.append('internName', this.internName());
    formData.append('internId', this.internId());

    this.docs().forEach((doc) => {
      if (doc.file) {
        const fileName = `${this.internId()}_${doc.key}.pdf`;
        formData.append('files', doc.file, fileName);
      }
    });

    this.apiService.sendInternDocuments(formData).subscribe({
      next: async () => {
        // Mark status as ongoing after successful upload
        this.apiService.updateInternStatus(this.internId(), 'ongoing').subscribe({
          next: () => {},
          error: (e) => console.warn('Failed to update intern status:', e)
        });

        this.docs.update(docs => docs.map(d => ({ ...d, status: 'success' as const })));
        this.isUploading.set(false);
        this.alertService.show('Documents submitted successfully! Your application is under review.');

        // Update local cache status
        try {
          const data = localStorage.getItem('user_data');
          if (data) {
            const parsed = JSON.parse(data);
            parsed.status = 'ongoing';
            localStorage.setItem('user_data', JSON.stringify(parsed));
          }
        } catch (e) {}

        setTimeout(() => this.router.navigate(['/intern/dashboard']), 1500);
      },
      error: (err) => {
        this.docs.update(docs => docs.map(d => ({ ...d, status: 'error' as const })));
        this.isUploading.set(false);
        this.alertService.show(err.error?.error || 'Upload failed. Please try again.');
      }
    });
  }

  toggleConsent(field: 'consentGiven' | 'infoAccurate' | 'consentBgVerification' | 'agreeCommunication') {
    if (field === 'consentGiven') this.consentGiven.update(v => !v);
    if (field === 'infoAccurate') this.infoAccurate.update(v => !v);
    if (field === 'consentBgVerification') this.consentBgVerification.update(v => !v);
    if (field === 'agreeCommunication') this.agreeCommunication.update(v => !v);
  }
}
