import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { ApiService } from '../../../api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { PdfGeneratorService } from '../../../shared/utils/pdf-generator.service';

@Component({
  selector: 'app-proposal-generator-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proposal-generator-modal.component.html',
  styleUrls: ['./proposal-generator-modal.component.css']
})
export class ProposalGeneratorModalComponent implements OnInit, OnDestroy {
  @Input() lead: any = null;
  @Input() companyCode: string = '';
  @Input() show: boolean = false;
  
  @Output() close = new EventEmitter<void>();
  @Output() onProposalSent = new EventEmitter<void>();

  templates: any[] = [];
  selectedTemplateId: string = '';
  
  // Array of { key, label, value, maxChars } for custom placeholders
  customPlaceholders: { key: string, label: string, value: string, maxChars?: number }[] = [];
  // Array of { key, label, value, maxChars } for standard auto-filled placeholders
  standardPlaceholders: { key: string, label: string, value: string, maxChars?: number }[] = [];
  
  loadingTemplates = false;
  generating = false;
  error = '';
  
  previewPdfUrl: SafeResourceUrl | null = null;
  private previewDebounce = new Subject<void>();
  private sub?: Subscription;

  constructor(
    private api: ApiService,
    private pdfSvc: PdfGeneratorService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    if (this.show && this.companyCode) {
      this.fetchTemplates();
    }
    
    this.sub = this.previewDebounce.pipe(
      debounceTime(500)
    ).subscribe(() => {
      this.updatePreview();
    });
  }

  ngOnDestroy() {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }

  fetchTemplates() {
    this.loadingTemplates = true;
    this.error = '';
    this.api.get<{success: boolean, templates: any[]}>(`/api/auth/proposals?companyCode=${this.companyCode}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.templates = res.templates || [];
        } else {
          this.error = 'Failed to load templates.';
        }
        this.loadingTemplates = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'Error loading proposal templates.';
        this.loadingTemplates = false;
      }
    });
  }

  onTemplateSelect() {
    this.customPlaceholders = [];
    this.standardPlaceholders = [];
    const tpl = this.templates.find(t => t._id === this.selectedTemplateId);
    if (!tpl) return;

    const seen = new Set<string>();
    
    for (const page of tpl.pages) {
      for (const layer of page.layers) {
        if (layer.type === 'text' && layer.isPlaceholder) {
          const key = layer.placeholderLabel;
          if (key && !seen.has(key)) {
            seen.add(key);
            const maxChars = layer.placeholderMaxChars;
            if (this.isStandardField(key)) {
              this.standardPlaceholders.push({ key, label: key, value: this.getStandardFieldValue(key), maxChars });
            } else {
              this.customPlaceholders.push({ key, label: key, value: '', maxChars });
            }
          }
        }
      }
    }
    
    this.triggerPreview();
  }

  triggerPreview() {
    this.previewDebounce.next();
  }

  private async updatePreview() {
    const tpl = this.templates.find(t => t._id === this.selectedTemplateId);
    if (!tpl) {
      this.previewPdfUrl = null;
      return;
    }

    try {
      const dynamicData: Record<string, string> = {};
      for (const sp of this.standardPlaceholders) {
        dynamicData[sp.key] = sp.value;
      }
      for (const cp of this.customPlaceholders) {
        dynamicData[cp.key] = cp.value;
      }

      const blob = await this.pdfSvc.generatePdfBlob(tpl.pages, tpl.name, dynamicData);
      const objectUrl = URL.createObjectURL(blob);
      this.previewPdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
    } catch (e) {
      console.error('Failed to generate preview PDF', e);
    }
  }

  private isStandardField(key: string): boolean {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const standard = ['clientname', 'companyname', 'clientemail', 'clientphone'];
    return standard.includes(normalized);
  }

  private getStandardFieldValue(key: string): string {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized === 'clientname') return this.lead?.contactName || this.lead?.name || '';
    if (normalized === 'companyname') return this.lead?.companyName || '';
    if (normalized === 'clientemail') return this.lead?.directorEmailAddress || this.lead?.email || '';
    if (normalized === 'clientphone') return this.lead?.contactNumber || this.lead?.phone || '';
    return '';
  }

  closeModal() {
    this.close.emit();
  }

  async generatePdf(action: 'download' | 'send') {
    const tpl = this.templates.find(t => t._id === this.selectedTemplateId);
    if (!tpl) return;

    this.generating = true;
    this.error = '';
    try {
      // Build dynamic data
      const dynamicData: Record<string, string> = {};
      for (const sp of this.standardPlaceholders) {
        dynamicData[sp.key] = sp.value;
      }
      for (const cp of this.customPlaceholders) {
        dynamicData[cp.key] = cp.value;
      }

      const blob = await this.pdfSvc.generatePdfBlob(tpl.pages, tpl.name, dynamicData);

      if (action === 'download') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tpl.name}_${this.lead?.name || 'Lead'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.onProposalSent.emit();
      } else if (action === 'send') {
        // Send via email API (we can use the same API used for invoices/quotes if one exists,
        // or just mock it / alert for now based on requirement)
        alert('Sending as email is not fully wired to a specific mail endpoint in this demo. Downloading instead.');
        this.generatePdf('download');
      }

    } catch (e: any) {
      console.error(e);
      this.error = 'Failed to generate PDF: ' + e.message;
    } finally {
      this.generating = false;
    }
  }
}
