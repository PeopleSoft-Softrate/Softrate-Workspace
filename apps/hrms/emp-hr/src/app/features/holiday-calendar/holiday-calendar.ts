import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Calendar01Icon,
  Clock01Icon,
  StarIcon,
  PlusSignIcon,
  Delete01Icon,
  FilterIcon,
  FloppyDiskIcon,
  Upload02Icon,
  GoogleSheetIcon,
  FileQuestionMarkIcon
} from '@hugeicons/core-free-icons';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-holiday-calendar',
  standalone: true,
  imports: [CommonModule, HugeiconsIconComponent, FormsModule],
  templateUrl: './holiday-calendar.html',
  styleUrl: './holiday-calendar.css'
})
export class HolidayCalendar implements OnInit {
  private apiService = inject(ApiService);

  // Icons
  readonly CalendarIcon = Calendar01Icon;
  readonly ClockIcon    = Clock01Icon;
  readonly StarIcon     = StarIcon;
  readonly PlusIcon     = PlusSignIcon;
  readonly DeleteIcon   = Delete01Icon;
  readonly FilterIcon   = FilterIcon;
  readonly SaveIcon     = FloppyDiskIcon;
  readonly UploadIcon             = GoogleSheetIcon;
  readonly FileQuestionMarkIcon   = FileQuestionMarkIcon;

  // Weekly off config
  days  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  weeks = [
    { id: 1, label: '1st Week' },
    { id: 2, label: '2nd Week' },
    { id: 3, label: '3rd Week' },
    { id: 4, label: '4th Week' },
    { id: 5, label: '5th Week' }
  ];

  selectedDay   = signal<string | null>(null);
  selectedWeeks = signal<number[]>([]);
  weeklyHolidaysMap = signal<Record<string, number[]>>({});

  // Special holidays & filters
  allSpecialHolidays = signal<any[]>([]);
  filterMode    = signal<'today' | 'upcoming' | 'past' | 'all'>('upcoming');
  selectedMonth = signal<number>(0);
  selectedYear  = signal<number>(new Date().getFullYear());

  isLoading = signal(true);
  isSaving  = signal(false);

  months = [
    { value: 0,  label: 'All Months' },
    { value: 1,  label: 'January'   },
    { value: 2,  label: 'February'  },
    { value: 3,  label: 'March'     },
    { value: 4,  label: 'April'     },
    { value: 5,  label: 'May'       },
    { value: 6,  label: 'June'      },
    { value: 7,  label: 'July'      },
    { value: 8,  label: 'August'    },
    { value: 9,  label: 'September' },
    { value: 10, label: 'October'   },
    { value: 11, label: 'November'  },
    { value: 12, label: 'December'  }
  ];

  years = [2024, 2025, 2026];

  filteredSpecialHolidays = computed(() => {
    const holidays = this.allSpecialHolidays();
    const mode     = this.filterMode();
    const month    = this.selectedMonth();
    const year     = this.selectedYear();
    const today    = new Date();
    today.setHours(0, 0, 0, 0);

    return holidays
      .filter(h => {
        const from = new Date(h.fromDate);
        const to   = new Date(h.toDate);

        const matchesYear  = year  === 0 || from.getFullYear() === year  || to.getFullYear() === year;
        const matchesMonth = month === 0 || from.getMonth() + 1 === month || to.getMonth() + 1 === month;
        if (!matchesYear || !matchesMonth) return false;

        switch (mode) {
          case 'today':    return from <= today && to >= today;
          case 'upcoming': return from >= today;
          case 'past':     return to < today;
          default:         return true;
        }
      })
      .sort((a, b) => new Date(a.fromDate).getTime() - new Date(b.fromDate).getTime());
  });

  newHoliday = { type: 'special', fromDate: '', toDate: '', reason: '' };

  ngOnInit() {
    this.fetchHolidays();
  }

  fetchHolidays() {
    this.isLoading.set(true);
    this.apiService.getHolidays().subscribe({
      next: (data: any[]) => {
        this.allSpecialHolidays.set(data.filter((h: any) => h.type === 'special'));

        const weeklyMap: Record<string, number[]> = {};
        data.filter((h: any) => h.type === 'weekly').forEach(h => {
          weeklyMap[h.day] = h.weeks;
        });
        this.weeklyHolidaysMap.set(weeklyMap);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        console.error('Failed to fetch holidays', err);
        this.isLoading.set(false);
      }
    });
  }

  selectDay(day: string) {
    this.selectedDay.set(day);
    this.selectedWeeks.set(this.weeklyHolidaysMap()[day] || []);
  }

  toggleWeek(weekId: number) {
    const current = [...this.selectedWeeks()];
    const index   = current.indexOf(weekId);
    index > -1 ? current.splice(index, 1) : current.push(weekId);
    this.selectedWeeks.set(current);
  }

  saveWeeklyHoliday() {
    const day = this.selectedDay();
    if (!day) return;
    this.isSaving.set(true);
    this.apiService.saveHoliday({ type: 'weekly', day, weeks: this.selectedWeeks() }).subscribe({
      next: () => {
        alert('Weekly holiday updated');
        this.fetchHolidays();
        this.isSaving.set(false);
      },
      error: (err: any) => {
        alert('Failed to update: ' + (err.error?.message || err.message));
        this.isSaving.set(false);
      }
    });
  }

  addHoliday() {
    if (!this.newHoliday.fromDate || !this.newHoliday.toDate || !this.newHoliday.reason) {
      alert('Please fill all fields');
      return;
    }
    this.isSaving.set(true);
    this.apiService.saveHoliday(this.newHoliday).subscribe({
      next: () => {
        this.fetchHolidays();
        this.newHoliday = { type: 'special', fromDate: '', toDate: '', reason: '' };
        this.isSaving.set(false);
      },
      error: (err: any) => {
        alert('Failed to save: ' + (err.error?.message || err.message));
        this.isSaving.set(false);
      }
    });
  }

  deleteHoliday(id: string) {
    if (!confirm('Delete this holiday?')) return;
    this.apiService.deleteHoliday(id).subscribe({
      next: () => this.fetchHolidays(),
      error: (err: any) => alert('Failed to delete: ' + (err.error?.message || err.message))
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      const parsedHolidays = jsonData.map(row => {
        // Expected columns: Date (or fromDate), Reason (or reason), toDate (optional)
        const rawDate = row['Date'] || row['fromDate'] || row['date'];
        const reason = row['Reason'] || row['reason'] || row['Name'] || row['name'];
        const rawToDate = row['toDate'] || row['To Date'] || rawDate;

        if (!rawDate || !reason) return null;

        return {
          type: 'special',
          fromDate: this.formatExcelDate(rawDate),
          toDate: this.formatExcelDate(rawToDate),
          reason: reason
        };
      }).filter(h => h !== null);

      if (parsedHolidays.length > 0) {
        this.isSaving.set(true);
        this.apiService.saveBulkHolidays(parsedHolidays).subscribe({
          next: () => {
            alert(`${parsedHolidays.length} holidays imported successfully!`);
            this.fetchHolidays();
            this.isSaving.set(false);
            event.target.value = ''; // Reset input
          },
          error: (err) => {
            alert('Failed to import: ' + (err.error?.message || err.message));
            this.isSaving.set(false);
          }
        });
      } else {
        alert('No valid holidays found in the file. Please ensure columns are named "Date" and "Reason".');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private formatExcelDate(excelDate: any): string {
    if (typeof excelDate === 'number') {
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    // Try to parse string date
    try {
      const date = new Date(excelDate);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {}
    return '';
  }
}