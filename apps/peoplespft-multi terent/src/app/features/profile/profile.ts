import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class ProfileComponent implements OnInit {
  private apiService = inject(ApiService);
  private sanitizer  = inject(DomSanitizer);

  user   = signal<any>(null);
  role   = signal<string>('');
  isLoading = signal<boolean>(true);
  error  = signal<string | null>(null);

  companyLogo       = signal<string | null>(null);
  qrCodeUrl         = signal<string | null>(null);
  virtualIdTemplate = signal<any>(null); // custom template from Certificate Settings

  isEditing = signal<boolean>(false);
  editData: any = {};
  
  // New state variables
  companyLocations = signal<any[]>([]);
  expertiseTags = signal<string[]>([]);
  newExpertiseTag = signal('');

  // ── Computed: handles HR / Employee / Intern field differences ──────────────
  displayName = computed(() => {
    const u = this.user();
    if (!u) return 'User';
    if (u.fullName) return u.fullName;
    if (u.profile?.firstName) return `${u.profile.firstName} ${u.profile.lastName || ''}`.trim();
    return 'User';
  });

  displayRole = computed(() => {
    const r = this.role();
    if (r === 'hr' || r === 'hr_admin' || r === 'admin') return 'HR Manager';
    if (r === 'manager')  return 'Manager';
    if (r === 'intern')   return 'Intern';
    if (r === 'employee') return 'Employee';
    return this.user()?.designation || this.user()?.role || 'Employee';
  });

  // Employee → EmployeeId, Intern → internid, HR → employeeId
  displayId = computed(() => {
    const u = this.user();
    if (!u) return 'N/A';
    return u.EmployeeId || u.internid || u.employeeId || 'N/A';
  });

  displayEmail = computed(() => this.user()?.email || 'N/A');
  displayPhone = computed(() => this.user()?.phone || this.user()?.contact || this.user()?.phoneNumber || 'N/A');
  profilePhoto = computed(() => this.user()?.profilePhotoUrl || this.user()?.profilePhoto?.url || null);
  profileCompletion = computed(() => {
    const u = this.user();
    if (!u) return 0;
    
    const fieldsToTrack = [
      u.fullName,
      u.email,
      u.phone || u.contact || u.phoneNumber,
      u.EmployeeId || u.internid || u.employeeId,
      u.dob,
      u.age,
      u.gender,
      u.maritalStatus,
      u.aboutMe,
      u.askMeAboutExpertise,
      u.profilePhotoUrl || u.profilePhoto?.url || u.profilePhoto?.data
    ];
    
    const filledFields = fieldsToTrack.filter(f => {
      if (f === null || f === undefined) return false;
      if (typeof f === 'string' && f.trim() === '') return false;
      return true;
    });
    
    return Math.round((filledFields.length / fieldsToTrack.length) * 100);
  });
  
  displayDob = computed(() => {
    const dob = this.user()?.dob;
    return dob ? new Date(dob).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '-';
  });

  calculateAge(dobString: string | Date | undefined): string {
    if (!dobString) return '';
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  }

  displayAge = computed(() => {
    const dob = this.user()?.dob;
    if (dob) {
      const computedAge = this.calculateAge(dob);
      if (computedAge) return computedAge;
    }
    return this.user()?.age || '-';
  });
  displayGender = computed(() => this.user()?.gender || '-');
  displayMaritalStatus = computed(() => this.user()?.maritalStatus || '-');
  displayAboutMe = computed(() => this.user()?.aboutMe || '-');
  displayBloodGroup = computed(() => this.user()?.bloodGroup || '-');
  displayWorkLocation = computed(() => this.user()?.workLocation || '-');
  displayAddress = computed(() => this.user()?.address || '-');
  displayEmergencyName = computed(() => this.user()?.emergencyName || '-');
  displayEmergencyPhone = computed(() => this.user()?.emergencyPhone || '-');
  
  displayExpertise = computed(() => {
    const expertise = this.user()?.askMeAboutExpertise;
    if (expertise) {
      if (Array.isArray(expertise)) return expertise.join(', ');
      return expertise.toString();
    }
    return '-';
  });
  displayNickName = computed(() => this.user()?.nickName || '-');

  userInitials = computed(() => {
    const name = this.displayName();
    if (!name || name === 'User') return '?';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  });

  // ── Custom VID template renderer ─────────────────────────────────────────────
  /** First page of the saved virtualIdCard template */
  vidPage = computed(() => {
    const t = this.virtualIdTemplate();
    return t?.pages?.[0] ?? null;
  });

  /** Scale factor: A4 portrait canvas 595 px → card display 340 px */
  readonly VID_CANVAS_W = 595;
  readonly VID_CARD_W   = 340;
  get vidScale() { return this.VID_CARD_W / this.VID_CANVAS_W; }
  get vidCardH()  { return Math.round(842 * this.vidScale); }

  vidBgStyle(page: any): SafeStyle {
    if (!page?.backgroundUrl) return '';
    return this.sanitizer.bypassSecurityTrustStyle(`url('${page.backgroundUrl}')`);
  }

  readonly IMAGE_KEYS = ['logo', 'signature', 'qrCode', 'profilePhoto'];
  isVidImageKey(key: string) { return this.IMAGE_KEYS.includes(key); }

  resolveVidValue(key: string): string {
    const u = this.user();
    switch (key) {
      case 'fullName':       return this.displayName();
      case 'internId':
      case 'EmployeeId':     return this.displayId();
      case 'role':           return this.displayRole();
      case 'email':          return this.displayEmail();
      case 'department':     return u?.department || u?.departmentId?.name || '';
      case 'college':        return u?.college || '';
      case 'onboardingDate': return u?.onboardingDate ? new Date(u.onboardingDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '';
      case 'endDate':        return u?.endDate       ? new Date(u.endDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '';
      case 'todayDate':      return new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
      case 'logo':           return this.companyLogo() || '';
      case 'qrCode':         return this.qrCodeUrl()   || '';
      case 'profilePhoto':   return this.profilePhoto() || '';
      default:               return u?.[key] || '';
    }
  }

  resolveVidParagraph(text: string): string {
    if (!text) return '';
    return text.replace(/\{\{([^}]+)\}\}/g, (_, k) => this.resolveVidValue(k.trim()));
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.fetchProfile();
    this.fetchCompanySettings();
  }

  fetchProfile() {
    this.isLoading.set(true);
    this.apiService.getMe().subscribe({
      next: (res: any) => {
        if (res.success && res.user) {
          this.user.set(res.user);
          this.role.set(res.role || '');
          this._buildQrCode(res.user);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load profile', err);
        this.error.set('Failed to load user profile');
        this.isLoading.set(false);
      }
    });
  }

  private _buildQrCode(user: any) {
    const origin    = typeof window !== 'undefined' ? window.location.origin : 'https://peoplesoft.softrateglobal.com';
    const companyId = user.companyId?._id || user.companyId || '';
    const userId    = user.EmployeeId || user.internid || user.employeeId || user._id || '';
    if (companyId && userId) {
      const vidUrl = `${origin}/hrms/id-card/${companyId}/${userId}`;
      this.qrCodeUrl.set(`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(vidUrl)}`);
    }
  }

  fetchCompanySettings() {
    this.apiService.getCompanySettings().subscribe({
      next: (res: any) => {
        if (res.success) {
          if (res.settings?.communication?.emailLogoUrl) {
            this.companyLogo.set(res.settings.communication.emailLogoUrl);
          }
          // Load custom VID template only if it has real content
          const tmpl = res.offerLetterSettings?.documentTemplates?.virtualIdCard;
          if (tmpl?.pages?.some((p: any) => p.backgroundUrl || p.placeholders?.length || p.paragraphs?.length)) {
            this.virtualIdTemplate.set(tmpl);
          }
          if (res.settings?.locations) {
            this.companyLocations.set(res.settings.locations);
          } else if (res.company?.locations) {
            this.companyLocations.set(res.company.locations);
          }
        }
      }
    });
  }

  toggleEdit() {
    if (this.isEditing()) {
      this.isEditing.set(false);
    } else {
      const u = this.user();
      
      // Parse tags
      let tags: string[] = [];
      if (u?.askMeAboutExpertise) {
        if (Array.isArray(u.askMeAboutExpertise)) {
          tags = [...u.askMeAboutExpertise];
        } else if (typeof u.askMeAboutExpertise === 'string') {
          tags = u.askMeAboutExpertise.split(',').map((s: string) => s.trim()).filter((s: string) => s);
        }
      }
      this.expertiseTags.set(tags);

      this.editData = {
        fullName: u?.fullName || '',
        email: u?.email || '',
        phone: u?.contact || u?.phoneNumber || u?.phone || '',
        nickName: u?.nickName || '',
        dob: u?.dob ? new Date(u.dob).toISOString().split('T')[0] : '',
        age: u?.age || '',
        gender: u?.gender || '',
        maritalStatus: u?.maritalStatus || '',
        bloodGroup: u?.bloodGroup || '',
        workLocation: u?.workLocation || '',
        address: u?.address || '',
        emergencyName: u?.emergencyName || '',
        emergencyPhone: u?.emergencyPhone || '',
        aboutMe: u?.aboutMe || '',
        askMeAboutExpertise: tags.join(',')
      };
      this.isEditing.set(true);
    }
  }

  addTag(event: any) {
    event.preventDefault();
    const val = this.newExpertiseTag().trim();
    if (val) {
      this.expertiseTags.update(t => [...t, val]);
      this.newExpertiseTag.set('');
    }
  }

  removeTag(index: number) {
    this.expertiseTags.update(t => t.filter((_, i) => i !== index));
  }

  saveProfile() {
    const data = { ...this.editData };
    
    // Auto-calculate age from DOB if present
    if (data.dob) {
      const calcAge = this.calculateAge(data.dob);
      if (calcAge) {
        data.age = parseInt(calcAge, 10);
      }
    }

    // Convert tags back to string (or keep as array if backend accepts it)
    data.askMeAboutExpertise = this.expertiseTags();

    const u = this.user();
    if (!u || !u._id) return;
    
    const isIntern = this.role() === 'intern' || !!u.internid;
    this.isLoading.set(true);
    
    const updateObs = isIntern ? 
      this.apiService.updateIntern(u._id, data) : 
      this.apiService.updateEmployee(u._id, data);

    updateObs.subscribe({
      next: (res) => {
        this.isEditing.set(false);
        this.fetchProfile();
      },
      error: (err) => {
        console.error('Failed to update profile', err);
        this.error.set('Failed to update profile');
        this.isLoading.set(false);
      }
    });
  }
}
