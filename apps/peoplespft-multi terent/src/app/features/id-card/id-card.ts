import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-id-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './id-card.html',
  styleUrls: ['./id-card.css']
})
export class IdCardComponent implements OnInit {
  companyId = signal<string | null>(null);
  userId = signal<string | null>(null);
  
  profileData = signal<any>(null);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private apiService: ApiService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.companyId.set(params.get('companyId'));
      this.userId.set(params.get('id'));
      
      if (this.companyId() && this.userId()) {
        this.fetchIdCard();
      } else {
        this.error.set('Invalid link parameters.');
        this.isLoading.set(false);
      }
    });
  }

  fetchIdCard() {
    this.isLoading.set(true);
    this.error.set(null);
    
    // We append the timestamp cache buster to avoid caching issues
    const url = `${this.apiService.getBaseUrl()}/api/public/id-card/${this.userId()}?companyId=${this.companyId()}&_t=${new Date().getTime()}`;
    
    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.profileData.set(res.data);
        } else {
          this.error.set('Could not load ID card.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Fetch ID Card Error:', err);
        this.error.set('ID Card not found or an error occurred.');
        this.isLoading.set(false);
      }
    });
  }

  get userInitials(): string {
    const data = this.profileData();
    if (!data || !data.fullName) return 'ID';
    return data.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  // ── Custom VID template renderer ─────────────────────────────────────────────
  
  get virtualIdTemplate(): any {
    return this.profileData()?.virtualIdTemplate || null;
  }

  get vidPage(): any {
    const t = this.virtualIdTemplate;
    return t?.pages?.[0] ?? null;
  }

  readonly VID_CANVAS_W = 595;
  readonly VID_CARD_W   = 340;
  get vidScale() { return this.VID_CARD_W / this.VID_CANVAS_W; }
  get vidCardH()  { return Math.round(842 * this.vidScale); }

  vidBgStyle(page: any): any {
    if (!page?.backgroundUrl) return '';
    return this.sanitizer.bypassSecurityTrustStyle(`url('${page.backgroundUrl}')`);
  }

  readonly IMAGE_KEYS = ['logo', 'signature', 'qrCode', 'profilePhoto'];
  isVidImageKey(key: string) { return this.IMAGE_KEYS.includes(key); }

  resolveVidValue(key: string): string {
    const data = this.profileData();
    if (!data) return '';
    
    switch (key) {
      case 'fullName':       return data.fullName || '';
      case 'internId':
      case 'EmployeeId':     return data.id || '';
      case 'role':           return data.role || '';
      case 'email':          return data.email || '';
      case 'logo':           return data.companyLogo || '';
      case 'profilePhoto':   return data.profilePhoto || '';
      // We can generate a QR code pointing to this exact URL
      case 'qrCode':         {
        const url = typeof window !== 'undefined' ? window.location.href : '';
        return url ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}` : '';
      }
      case 'todayDate':      return new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
      default:               return data[key] || '';
    }
  }

  resolveVidParagraph(text: string): string {
    if (!text) return '';
    return text.replace(/\{\{([^}]+)\}\}/g, (_, k) => this.resolveVidValue(k.trim()));
  }
  
  downloadCard() {
    // Basic download via window.print or triggering a canvas save.
    // We will use html2canvas to capture the ID card and download it as PNG.
    const element = document.querySelector('.custom-vid-wrapper, .virtual-id-card') as HTMLElement;
    if (!element) {
      console.error('ID Card element not found!');
      return;
    }
    
    // Set a slight delay to ensure images/fonts are fully rendered
    setTimeout(() => {
      html2canvas(element, {
        scale: 2, // higher resolution
        useCORS: true, // allow cross-origin images like profile photo/QR code
        backgroundColor: null // transparent or default
      }).then((canvas) => {
        const link = document.createElement('a');
        link.download = `ID_Card_${this.profileData()?.fullName?.replace(/\s+/g, '_') || 'Employee'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }).catch(err => {
        console.error('Failed to generate image', err);
        // Fallback to print if canvas fails
        window.print();
      });
    }, 300);
  }
}
