import { AlertService } from '../../shared/services/alert';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { CheckmarkCircle01Icon, DiplomaIcon, OrientationLandscapeToPotraitIcon, OrientationPotraitToLandscapeIcon, LicenseDraftIcon, Invoice01Icon, Shield01Icon, IdCardLanyardIcon } from '@hugeicons/core-free-icons';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-certificate-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, HugeiconsIconComponent],
  templateUrl: './certificate-settings.html',
  styleUrl: './certificate-settings.css'
})
export class CertificateSettings implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  /** Preview URL for the current logged-in user's profile photo (used in canvas preview) */
  currentUserPhotoUrl: string | null = null;

  readonly CheckmarkCircle01Icon = CheckmarkCircle01Icon;
  readonly DiplomaIcon = DiplomaIcon;
  readonly OrientationLandscapeToPotraitIcon = OrientationLandscapeToPotraitIcon;
  readonly OrientationPotraitToLandscapeIcon = OrientationPotraitToLandscapeIcon;
  readonly LicenseDraftIcon = LicenseDraftIcon;
  readonly Invoice01Icon = Invoice01Icon;
  readonly Shield01Icon = Shield01Icon;
  readonly IdCardLanyardIcon = IdCardLanyardIcon;

  /** Safe placeholder hint for the paragraph textarea — avoids Angular strict-template parsing {{}} */
  readonly paraPlaceholderHint =
    'Type your content here\u2026 Use the Insert Placeholder dropdown above to add dynamic fields like ' +
    '{' + '{' + 'fullName' + '}' + '}'  + '.';

  readonly availableFonts = [
    { name: 'System Default', value: 'inherit' },
    { name: 'Inter', value: "'Inter', sans-serif" },
    { name: 'Outfit', value: "'Outfit', sans-serif" },
    { name: 'Playfair Display', value: "'Playfair Display', serif" },
    { name: 'Great Vibes (Script)', value: "'Great Vibes', cursive" },
    { name: 'Montserrat', value: "'Montserrat', sans-serif" },
    { name: 'Georgia', value: "Georgia, serif" },
    { name: 'Courier New', value: "'Courier New', monospace" }
  ];

  /** Default page now includes paragraphs array */
  defaultPage() {
    return { backgroundUrl: '', placeholders: [], paragraphs: [] };
  }

  defaultTemplate(orientation = 'portrait') {
    return { orientation, pages: [this.defaultPage()] };
  }

  documentTemplates: any = {
    offerLetter:          this.defaultTemplate('portrait'),
    annexure:             this.defaultTemplate('portrait'),
    nda:                  this.defaultTemplate('portrait'),
    lor:                  this.defaultTemplate('landscape'),
    internshipCompletion: this.defaultTemplate('landscape'),
    projectCompletion:    this.defaultTemplate('landscape'),
    virtualIdCard:        this.defaultTemplate('portrait')
  };

  otherSettings: any = {};
  selectedDocType: string = 'offerLetter';
  selectedPageIndex: number = 0;
  isLoading = true;
  isSaving = false;

  emailLogoUrl: string = '';
  emailSignatureUrl: string = '';

  // Unified drag state for both placeholder chips and paragraph blocks
  draggingType: 'placeholder' | 'paragraph' | null = null;
  draggingIndex: number | null = null;
  dragOffset = { x: 0, y: 0 };

  docCategories = [
    {
      name: 'Onboarding Documents',
      docs: [
        { id: 'offerLetter', label: 'Offer Letter', icon: this.LicenseDraftIcon },
        { id: 'annexure',    label: 'Annexure', icon: this.Invoice01Icon },
        { id: 'nda',         label: 'NDA', icon: this.Shield01Icon }
      ]
    },
    {
      name: 'Offboarding Documents',
      docs: [
        { id: 'lor',                  label: 'Letter of Recommendation', icon: this.DiplomaIcon },
        { id: 'internshipCompletion', label: 'Internship Completion', icon: this.CheckmarkCircle01Icon },
        { id: 'projectCompletion',    label: 'Project Completion', icon: this.CheckmarkCircle01Icon }
      ]
    },
    {
      name: 'Identity Documents',
      docs: [
        { id: 'virtualIdCard',        label: 'Virtual ID Card', icon: this.IdCardLanyardIcon }
      ]
    }
  ];

  availablePlaceholderKeys = [
    { key: 'fullName',       label: 'Full Name' },
    { key: 'internId',       label: 'Intern ID' },
    { key: 'role',           label: 'Internship Role' },
    { key: 'onboardingDate', label: 'Onboarding Date' },
    { key: 'endDate',        label: 'End Date' },
    { key: 'todayDate',      label: 'Current Date' },
    { key: 'college',        label: 'College/University' },
    { key: 'department',     label: 'Department' },
    { key: 'logo',           label: 'Company Logo' },
    { key: 'signature',      label: 'Company Signature' },
    { key: 'qrCode',         label: 'QR Code (Virtual ID)' },
    { key: 'profilePhoto',   label: 'User Profile Photo' }
  ];

  isImageKey(key: string): boolean {
    return ['logo', 'signature', 'qrCode', 'profilePhoto'].includes(key);
  }

  ngOnInit() {
    this.fetchSettings();
    this.fetchCurrentUserPhoto();
  }

  fetchCurrentUserPhoto() {
    this.apiService.getMe().subscribe({
      next: (res: any) => {
        if (res?.user?.profilePhotoUrl) {
          this.currentUserPhotoUrl = res.user.profilePhotoUrl;
        }
      }
    });
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────
  fetchSettings() {
    this.isLoading = true;
    this.apiService.getCompanySettings().subscribe({
      next: (res: any) => {
        if (res.success) {
          if (res.settings && res.settings.communication) {
            this.emailLogoUrl = res.settings.communication.emailLogoUrl || '';
            this.emailSignatureUrl = res.settings.communication.emailSignatureUrl || '';
          }

          if (res.offerLetterSettings) {
            const saved = res.offerLetterSettings.documentTemplates || {};
          const types = Object.keys(this.documentTemplates);

          types.forEach(type => {
            if (saved[type]) {
              const s = saved[type];

              if (s.pages && s.pages.length > 0) {
                // Migrate each page to ensure paragraphs array exists
                const pages = s.pages.map((pg: any) => ({
                  ...pg,
                  paragraphs: pg.paragraphs || []
                }));
                this.documentTemplates[type] = {
                  orientation: s.orientation || this.documentTemplates[type].orientation,
                  pages
                };
              } else if (s.backgroundUrl !== undefined) {
                // Legacy single-page format
                this.documentTemplates[type] = {
                  orientation: s.orientation || this.documentTemplates[type].orientation,
                  pages: [{
                    backgroundUrl: s.backgroundUrl || '',
                    placeholders: s.placeholders || [],
                    paragraphs: []
                  }]
                };
              }
            }
          });

          const { documentTemplates: _ignored, ...rest } = res.offerLetterSettings;
          this.otherSettings = rest;
        }
      }
      this.isLoading = false;
      this.cdr.detectChanges();
    },
      error: (err) => {
        console.error('Failed to fetch settings', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Template helpers ───────────────────────────────────────────────────────
  get currentTemplate() {
    return this.documentTemplates[this.selectedDocType] || this.defaultTemplate();
  }

  get currentPage() {
    const t = this.currentTemplate;
    return t.pages?.[this.selectedPageIndex] || this.defaultPage();
  }

  selectDoc(docId: string) {
    this.selectedDocType = docId;
    this.selectedPageIndex = 0;
    this.draggingIndex = null;
    this.draggingType = null;
  }

  // ── Rendering for Canvas ───────────────────────────────────────────────────
  hasImagePlaceholder(text: string): boolean {
    if (!text) return false;
    return text.includes('{{logo}}') || text.includes('{{signature}}') || text.includes('{{qrCode}}') || text.includes('{{profilePhoto}}');
  }

  renderCanvasText(para: any): SafeHtml | string {
    let text = para.text;
    if (!text) return '(empty paragraph)';
    
    // Support regex parsing for sizes like {{signature:150x80}} in the preview too, or fallback to para.imgWidth/Height
    const applySize = (match: string, key: string, w: string, h: string) => {
      const parsedW = w ? `${w}px` : (para.imgWidth ? `${para.imgWidth}px` : 'auto');
      const parsedH = h ? `${h}px` : (para.imgHeight ? `${para.imgHeight}px` : '80px');
      const style = `max-width: 100%; width: ${parsedW}; height: ${parsedH}; object-fit: contain;`;
      
      if (key.toLowerCase() === 'logo') {
        const fallback = `<img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='80'><rect width='200' height='80' fill='%23f1f5f9' stroke='%23cbd5e1' stroke-width='2' stroke-dasharray='4'/><text x='100' y='45' font-family='sans-serif' font-size='14' text-anchor='middle' fill='%2364748b'>[Logo]</text></svg>" style="${style}">`;
        return this.emailLogoUrl ? `<img src="${this.emailLogoUrl}" style="${style}">` : fallback;
      }
      if (key.toLowerCase() === 'signature') {
        const fallback = `<img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='80'><rect width='200' height='80' fill='%23f1f5f9' stroke='%23cbd5e1' stroke-width='2' stroke-dasharray='4'/><text x='100' y='45' font-family='sans-serif' font-size='14' text-anchor='middle' fill='%2364748b'>[Signature]</text></svg>" style="${style}">`;
        return this.emailSignatureUrl ? `<img src="${this.emailSignatureUrl}" style="${style}">` : fallback;
      }
      if (key.toLowerCase() === 'qrcode') {
        const fallback = `<img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23f1f5f9' stroke='%23cbd5e1' stroke-width='2' stroke-dasharray='4'/><text x='50' y='55' font-family='sans-serif' font-size='16' text-anchor='middle' fill='%2364748b'>[QR]</text></svg>" style="${style}">`;
        return fallback;
      }
      if (key.toLowerCase() === 'profilephoto') {
        const fallback = `<img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><circle cx='50' cy='50' r='48' fill='%23f1f5f9' stroke='%23cbd5e1' stroke-width='2' stroke-dasharray='4'/><text x='50' y='55' font-family='sans-serif' font-size='14' text-anchor='middle' fill='%2364748b'>[Photo]</text></svg>" style="border-radius:50%; object-fit:cover; width: ${parsedW}; height: ${parsedH};">`;
        return this.currentUserPhotoUrl ? `<img src="${this.currentUserPhotoUrl}" style="border-radius:50%; object-fit:cover; width: ${parsedW}; height: ${parsedH};">` : fallback;
      }
      return match;
    };

    text = text.replace(/\{\{(logo|signature|qrCode|profilePhoto)(?::(\d+)(?:x(\d+))?)?\}\}/gi, applySize);
    
    // Markdown support for inline bold (**text**)
    text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    // Convert newlines to <br> for HTML rendering in the preview
    text = text.replace(/\n/g, '<br>');

    return this.sanitizer.bypassSecurityTrustHtml(text);
  }

  // ── Tab Management ─────────────────────────────────────────────────────────
  addPage() {
    this.currentTemplate.pages.push(this.defaultPage());
    this.selectedPageIndex = this.currentTemplate.pages.length - 1;
  }

  removePage(index: number) {
    if (this.currentTemplate.pages.length === 1) return;
    this.currentTemplate.pages.splice(index, 1);
    if (this.selectedPageIndex >= this.currentTemplate.pages.length) {
      this.selectedPageIndex = this.currentTemplate.pages.length - 1;
    }
  }

  // ── Background upload ──────────────────────────────────────────────────────
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { this.alertService.show('File size exceeds 5MB limit.'); return; }
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.currentPage.backgroundUrl = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ── Drag: placeholder chips ────────────────────────────────────────────────
  onMouseDown(event: MouseEvent, index: number) {
    this.draggingType = 'placeholder';
    this.draggingIndex = index;
    this.dragOffset.x = event.offsetX;
    this.dragOffset.y = event.offsetY;
    event.preventDefault();
  }

  // ── Drag: paragraph blocks ─────────────────────────────────────────────────
  onMouseDownParagraph(event: MouseEvent, index: number) {
    this.draggingType = 'paragraph';
    this.draggingIndex = index;
    this.dragOffset.x = event.offsetX;
    this.dragOffset.y = event.offsetY;
    event.preventDefault();
  }

  onMouseMove(event: MouseEvent) {
    if (this.draggingIndex === null || !this.draggingType) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const canvasW = this.currentTemplate.orientation === 'portrait' ? 595 : 842;
    const canvasH = this.currentTemplate.orientation === 'portrait' ? 842 : 595;
    const rawX = event.clientX - rect.left - this.dragOffset.x;
    const rawY = event.clientY - rect.top  - this.dragOffset.y;

    if (this.draggingType === 'placeholder') {
      const maxX = Math.max(0, canvasW - 80);
      const maxY = Math.max(0, canvasH - 30);
      this.currentPage.placeholders[this.draggingIndex].x = Math.round(Math.max(0, Math.min(rawX, maxX)));
      this.currentPage.placeholders[this.draggingIndex].y = Math.round(Math.max(0, Math.min(rawY, maxY)));
    } else if (this.draggingType === 'paragraph') {
      const para = this.currentPage.paragraphs[this.draggingIndex];
      const maxX = Math.max(0, canvasW - (para.width || 400));
      const maxY = Math.max(0, canvasH - 40);
      para.x = Math.round(Math.max(0, Math.min(rawX, maxX)));
      para.y = Math.round(Math.max(0, Math.min(rawY, maxY)));
    }
  }

  onMouseUp() {
    this.draggingIndex = null;
    this.draggingType = null;
  }

  // ── Placeholder chips ──────────────────────────────────────────────────────
  addPlaceholder() {
    this.currentPage.placeholders.push({
      key: 'fullName', x: 100, y: 100, fontSize: 18, imgSize: 120, isBold: false, color: '#000000'
    });
  }

  removePlaceholder(index: number) {
    this.currentPage.placeholders.splice(index, 1);
  }

  // ── Paragraph blocks ───────────────────────────────────────────────────────
  addParagraph() {
    if (!this.currentPage.paragraphs) this.currentPage.paragraphs = [];
    const count = this.currentPage.paragraphs.length;
    this.currentPage.paragraphs.push({
      id: Date.now().toString(),
      text: '',
      x: 50,
      y: 120 + count * 120,
      width: 400,
      fontSize: 14,
      fontFamily: 'inherit',
      alignment: 'left',
      letterSpacing: 0,
      lineHeight: 1.6,
      isBold: false,
      isItalic: false,
      color: '#000000',
      isCollapsed: false
    });
  }

  removeParagraph(index: number) {
    this.currentPage.paragraphs.splice(index, 1);
  }

  /** Insert a placeholder token at the textarea's cursor position */
  onInsertPlaceholder(paraIndex: number, event: Event) {
    const select = event.target as HTMLSelectElement;
    const key = select.value;
    if (!key) return;

    const token = '{{' + key + '}}';
    const para = this.currentPage.paragraphs[paraIndex];
    const textarea = document.getElementById('para-ta-' + paraIndex) as HTMLTextAreaElement;

    if (textarea) {
      const start = textarea.selectionStart ?? (para.text || '').length;
      const end   = textarea.selectionEnd   ?? start;
      const cur   = para.text || '';
      para.text = cur.substring(0, start) + token + cur.substring(end);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + token.length;
        textarea.focus();
      }, 0);
    } else {
      para.text = (para.text || '') + token;
    }

    // Reset select after a tick
    setTimeout(() => { select.value = ''; }, 0);
  }

  adjustFontSize(para: any, delta: number) {
    para.fontSize = Math.min(120, Math.max(6, (para.fontSize || 14) + delta));
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  saveSettings() {
    this.isSaving = true;
    const payload = {
      offerLetterSettings: {
        ...this.otherSettings,
        documentTemplates: this.documentTemplates
      }
    };

    this.apiService.updateCompanySettings(payload).pipe(
      finalize(() => this.isSaving = false)
    ).subscribe({
      next: () => this.alertService.show('All document templates saved successfully'),
      error: (err) => this.alertService.show('Failed to update settings: ' + (err.error?.message || err.message))
    });
  }
}
