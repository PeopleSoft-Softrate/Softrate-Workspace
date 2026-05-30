import { AlertService } from '../../shared/services/alert';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { CheckmarkCircle01Icon, DiplomaIcon, OrientationLandscapeToPotraitIcon, OrientationPotraitToLandscapeIcon } from '@hugeicons/core-free-icons';
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

  readonly CheckmarkCircle01Icon = CheckmarkCircle01Icon;
  readonly DiplomaIcon = DiplomaIcon;
  readonly OrientationLandscapeToPotraitIcon = OrientationLandscapeToPotraitIcon;
  readonly OrientationPotraitToLandscapeIcon = OrientationPotraitToLandscapeIcon;

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
    projectCompletion:    this.defaultTemplate('landscape')
  };

  otherSettings: any = {};
  selectedDocType: string = 'offerLetter';
  selectedPageIndex: number = 0;
  isLoading = true;
  isSaving = false;

  // Unified drag state for both placeholder chips and paragraph blocks
  draggingType: 'placeholder' | 'paragraph' | null = null;
  draggingIndex: number | null = null;
  dragOffset = { x: 0, y: 0 };

  docCategories = [
    {
      name: 'Onboarding Documents',
      docs: [
        { id: 'offerLetter', label: 'Offer Letter' },
        { id: 'annexure',    label: 'Annexure' },
        { id: 'nda',         label: 'NDA' }
      ]
    },
    {
      name: 'Offboarding Documents',
      docs: [
        { id: 'lor',                  label: 'Letter of Recommendation' },
        { id: 'internshipCompletion', label: 'Internship Completion' },
        { id: 'projectCompletion',    label: 'Project Completion' }
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
    { key: 'department',     label: 'Department' }
  ];

  ngOnInit() {
    this.fetchSettings();
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────
  fetchSettings() {
    this.isLoading = true;
    this.apiService.getCompanySettings().subscribe({
      next: (res: any) => {
        if (res.success && res.offerLetterSettings) {
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

  // ── Page management ────────────────────────────────────────────────────────
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
      key: 'fullName', x: 100, y: 100, fontSize: 18, isBold: false, color: '#000000'
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
