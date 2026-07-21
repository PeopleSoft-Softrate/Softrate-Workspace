import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Alert } from '../../shared/components/alert/alert';
import { AlertService } from '../../shared/services/alert';

@Component({
  selector: 'app-walkin-drives',
  standalone: true,
  imports: [CommonModule, FormsModule, Alert],
  templateUrl: './walkin-drives.component.html',
  styleUrls: ['./walkin-drives.component.css']
})
export class WalkinDrivesComponent implements OnInit {
  drives: any[] = [];
  activeDrives: any[] = [];
  historyDrives: any[] = [];
  isModalOpen = false;

  startDate = '';
  startTime = '';
  endDate = '';
  endTime = '';
  whatsappGroupLink = '';
  selectedFile: File | null = null;
  isSubmitting = false;

  isLoading = true;

  constructor(private apiService: ApiService, private alertService: AlertService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.fetchDrives();
  }

  fetchDrives(): void {
    this.isLoading = true;
    this.apiService.getWalkinDrives().subscribe({
      next: (res) => {
        // Pre-calculate status to avoid change detection lag
        this.drives = res.map((d: any) => ({
          ...d,
          computedStatus: this.getDriveStatus(d)
        }));
        this.activeDrives = this.drives.filter(d => d.computedStatus !== 'Ended');
        this.historyDrives = this.drives.filter(d => d.computedStatus === 'Ended');
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching drives', err);
        this.alertService.show('Error loading walkin drives', 'error');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getDriveStatus(drive: any): string {
    if (!drive.startDate || !drive.endDate || !drive.startTime || !drive.endTime) return 'Unknown';
    
    const now = new Date();
    
    const startDateStr = new Date(drive.startDate).toISOString().split('T')[0];
    const startDateTime = new Date(`${startDateStr}T${drive.startTime}:00`);
    
    const endDateStr = new Date(drive.endDate).toISOString().split('T')[0];
    const endDateTime = new Date(`${endDateStr}T${drive.endTime}:00`);

    if (now < startDateTime) {
      return 'Upcoming';
    } else if (now > endDateTime) {
      return 'Ended';
    } else {
      return 'Ongoing';
    }
  }

  openModal(): void {
    this.isModalOpen = true;
    this.resetForm();
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
    } else {
      this.alertService.show('Please select a valid PDF file', 'error');
      event.target.value = '';
    }
  }

  submitDrive(): void {
    if (!this.startDate || !this.startTime || !this.endDate || !this.endTime || !this.whatsappGroupLink || !this.selectedFile) {
      this.alertService.show('Please fill all fields and select a PDF', 'error');
      return;
    }

    this.isSubmitting = true;
    const formData = new FormData();
    formData.append('startDate', this.startDate);
    formData.append('startTime', this.startTime);
    formData.append('endDate', this.endDate);
    formData.append('endTime', this.endTime);
    formData.append('whatsappGroupLink', this.whatsappGroupLink);
    formData.append('jdPdf', this.selectedFile);

    this.apiService.createWalkinDrive(formData).subscribe({
      next: (res) => {
        this.alertService.show('Walkin Drive created successfully', 'success');
        this.isSubmitting = false;
        this.closeModal();
        this.fetchDrives();
      },
      error: (err) => {
        console.error('Error creating drive', err);
        this.alertService.show('Failed to create walkin drive', 'error');
        this.isSubmitting = false;
      }
    });
  }

  resetForm(): void {
    this.startDate = '';
    this.startTime = '';
    this.endDate = '';
    this.endTime = '';
    this.whatsappGroupLink = '';
    this.selectedFile = null;
  }

  getFullPdfUrl(url: string): string {
    return `${this.apiService.getBaseUrl()}${url}`;
  }
}
