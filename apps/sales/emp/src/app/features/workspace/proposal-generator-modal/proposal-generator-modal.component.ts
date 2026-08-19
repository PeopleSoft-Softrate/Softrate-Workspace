import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { ApiService } from '../../../api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { PdfGeneratorService } from '../../../shared/utils/pdf-generator.service';

declare const pdfjsLib: any;

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
  @Input() baseCompanyCode: string = '';
  @Input() collaboratingCompanies: string[] = [];
  @Input() show: boolean = false;
  
  @Output() close = new EventEmitter<void>();
  @Output() onProposalSent = new EventEmitter<{ action: 'download' | 'send', file?: File, templateName?: string }>();

  templates: any[] = [];
  selectedTemplateId: string = '';
  
  // Array of { key, label, value, maxChars } for custom placeholders
  customPlaceholders: { 
    key: string, label: string, value: string, _initialValue?: string, maxChars?: number,
    fontSize?: number, fontFamily?: string, color?: string, lineHeight?: number, 
    letterSpacing?: number, bold?: boolean, italic?: boolean, align?: string 
  }[] = [];
  // Array of { key, label, value, maxChars } for standard auto-filled placeholders
  standardPlaceholders: { key: string, label: string, value: string, maxChars?: number }[] = [];
  
  // Dynamic dropdown placeholders
  dropdownPlaceholders: { key: string, label: string, options: string[], selectedOptions: string[], customInput: string, value: string }[] = [];

  // Regular (non-placeholder) text layers the employee can edit
  editableTextLayers: {
    layerId: string, pageIndex: number, label: string,
    value: string, _initialValue: string,
    fontSize?: number, fontFamily?: string, color?: string,
    lineHeight?: number, letterSpacing?: number, bold?: boolean, italic?: boolean, align?: string
  }[] = [];
  
  loadingTemplates = false;
  generating = false;
  error = '';
  
  isRenderingPreview = false;
  hasCanvasRendered = false;
  fallbackIframeUrl: SafeResourceUrl | null = null;
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
      debounceTime(250)
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

  onCompanyChange(newCode: string) {
    this.companyCode = newCode;
    this.selectedTemplateId = '';
    this.customPlaceholders = [];
    this.standardPlaceholders = [];
    this.dropdownPlaceholders = [];
    this.editableTextLayers = [];
    this.clearCanvasPages();
    this.fallbackIframeUrl = null;
    this.fetchTemplates();
  }

  async onTemplateSelect() {
    this.customPlaceholders = [];
    this.standardPlaceholders = [];
    this.dropdownPlaceholders = [];
    this.editableTextLayers = [];
    let tpl = this.templates.find(t => t._id === this.selectedTemplateId);
    if (!tpl) return;

    if (!tpl.isFull) {
      this.loadingTemplates = true;
      try {
        const fullTpl: any = await new Promise((resolve, reject) => {
          this.api.get<{success: boolean, template: any}>(`/api/auth/proposals/${this.selectedTemplateId}?companyCode=${this.companyCode}`).subscribe({
            next: (res) => {
              if (res.success) resolve(res.template);
              else reject(new Error('Failed to load full template'));
            },
            error: (err) => reject(err)
          });
        });
        fullTpl.isFull = true;
        const index = this.templates.findIndex(t => t._id === this.selectedTemplateId);
        if (index !== -1) this.templates[index] = fullTpl;
        tpl = fullTpl;
      } catch (err) {
        console.error(err);
        this.error = 'Failed to load full template data.';
      } finally {
        this.loadingTemplates = false;
      }
    }

    const seen = new Set<string>();
    
    for (const page of tpl.pages) {
      for (const layer of page.layers) {
        if (layer.type === 'text' && layer.isPlaceholder) {
          const key = layer.placeholderLabel;
          if (key && !seen.has(key)) {
            seen.add(key);
            const maxChars = layer.placeholderMaxChars;
            if (layer.placeholderDropdownOptions && layer.placeholderDropdownOptions.length > 0) {
              this.dropdownPlaceholders.push({ 
                key, label: key, 
                options: layer.placeholderDropdownOptions, 
                selectedOptions: [], 
                customInput: '', 
                value: '[]' 
              });
            } else if (this.isStandardField(key)) {
              this.standardPlaceholders.push({ key, label: key, value: this.getStandardFieldValue(key), maxChars });
            } else {
              const existingContent = layer.content || '';
              this.customPlaceholders.push({ 
                key, label: key, 
                value: existingContent, _initialValue: existingContent, maxChars,
                fontSize: layer.fontSize || 16,
                fontFamily: layer.fontFamily || 'Inter',
                color: layer.color || '#000000',
                lineHeight: layer.lineHeight || 1.2,
                letterSpacing: layer.letterSpacing || 0,
                bold: layer.bold || false,
                italic: layer.italic || false,
                align: layer.align || 'left'
              });
            }
          }
        }
      }
    }

    // Collect regular (non-placeholder) text layers as editable fields
    let layerLabelIndex = 1;
    for (let pi = 0; pi < tpl.pages.length; pi++) {
      for (let li = 0; li < tpl.pages[pi].layers.length; li++) {
        const layer = tpl.pages[pi].layers[li];
        if (layer.type === 'text' && !layer.isPlaceholder && !layer.hidden && layer.content) {
          const layerId = layer.id || layer._id || `layer_${pi}_${li}`;
          layer.id = layerId;
          const label = layer.layerName || `Text Block ${layerLabelIndex++} (Page ${pi + 1})`;
          this.editableTextLayers.push({
            layerId: layerId,
            pageIndex: pi,
            label,
            value: layer.content,
            _initialValue: layer.content,
            fontSize: layer.fontSize || 16,
            fontFamily: layer.fontFamily || 'Inter',
            color: layer.color || '#000000',
            lineHeight: layer.lineHeight || 1.2,
            letterSpacing: layer.letterSpacing || 0,
            bold: layer.bold || false,
            italic: layer.italic || false,
            align: layer.align || 'left'
          });
        }
      }
    }
    
    this.triggerPreview();
  }

  triggerPreview() {
    this.previewDebounce.next();
  }

  execFormat(command: string, event?: any) {
    let value = null;
    if (event && event.target) {
      value = event.target.value;
      if (command === 'fontSize' && value === '') return;
    }
    document.execCommand(command, false, value);
    if (command === 'fontSize' && event && event.target) {
      event.target.value = ''; // Reset select
    }
  }

  onContentChange(event: any, cp: any) {
    cp.value = event.target.innerHTML;
  }

  addDropdownOption(dp: any, option: string) {
    const trimmed = (option || '').trim();
    if (trimmed && !dp.selectedOptions.includes(trimmed)) {
      dp.selectedOptions.push(trimmed);
      this.syncDropdownToPlaceholder(dp);
    }
    dp.customInput = '';
  }

  removeDropdownOption(dp: any, index: number) {
    dp.selectedOptions.splice(index, 1);
    this.syncDropdownToPlaceholder(dp);
  }

  syncDropdownToPlaceholder(dp: any) {
    dp.value = JSON.stringify(dp.selectedOptions);
    this.triggerPreview();
  }

  private getPagesWithEdits(): any[] {
    const tpl = this.templates.find(t => t._id === this.selectedTemplateId);
    if (!tpl) return [];
    // Deep clone pages so we don't mutate the cached template
    const pages = JSON.parse(JSON.stringify(tpl.pages));
    // Apply editable text layer changes
    for (const edit of this.editableTextLayers) {
      const page = pages[edit.pageIndex];
      if (!page || !page.layers) continue;
      const layer = page.layers.find((l: any) => (l.id && l.id === edit.layerId) || (l._id && l._id === edit.layerId));
      if (layer) layer.content = edit.value;
    }
    return pages;
  }

  private async updatePreview() {
    const tpl = this.templates.find(t => t._id === this.selectedTemplateId);
    if (!tpl) {
      this.clearCanvasPages();
      this.fallbackIframeUrl = null;
      return;
    }

    try {
      this.isRenderingPreview = true;
      const dynamicData: Record<string, string> = {};
      for (const sp of this.standardPlaceholders) {
        dynamicData[sp.key] = sp.value;
      }
      for (const cp of this.customPlaceholders) {
        dynamicData[cp.key] = cp.value;
      }
      for (const dp of this.dropdownPlaceholders) {
        dynamicData[dp.key] = dp.value;
      }

      const blob = await this.pdfSvc.generatePdfBlob(this.getPagesWithEdits(), tpl.name, dynamicData);

      if (typeof pdfjsLib !== 'undefined') {
        const arrayBuffer = await blob.arrayBuffer();
        await this.renderPdfToCanvas(arrayBuffer);
        this.hasCanvasRendered = true;
        this.fallbackIframeUrl = null;
      } else {
        const objectUrl = URL.createObjectURL(blob) + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH';
        this.fallbackIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
      }
    } catch (e) {
      console.error('Failed to generate preview PDF', e);
    } finally {
      this.isRenderingPreview = false;
    }
  }

  private async renderPdfToCanvas(arrayBuffer: ArrayBuffer) {
    const container = document.getElementById('pdfPagesHost');
    if (!container) return;

    try {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      let wrappers = container.querySelectorAll('.pdf-page-wrapper');
      if (wrappers.length !== numPages) {
        container.innerHTML = '';
        for (let i = 1; i <= numPages; i++) {
          const wrap = document.createElement('div');
          wrap.className = 'pdf-page-wrapper';
          wrap.style.cssText = 'position: relative; width: 100%; max-width: 760px; box-shadow: 0 4px 16px rgba(0,0,0,0.14); border-radius: 4px; overflow: hidden; background: #fff; display: flex; flex-direction: column; align-items: center;';
          
          const canvas = document.createElement('canvas');
          canvas.id = `pdf-canvas-page-${i}`;
          canvas.style.cssText = 'width: 100%; height: auto; display: block;';
          wrap.appendChild(canvas);

          const label = document.createElement('div');
          label.style.cssText = 'position: absolute; bottom: 8px; right: 12px; font-size: 11px; font-weight: 500; color: #64748b; background: rgba(255,255,255,0.9); backdrop-filter: blur(2px); padding: 2px 8px; border-radius: 10px; border: 1px solid #e2e8f0; pointer-events: none;';
          label.innerText = `Page ${i} of ${numPages}`;
          wrap.appendChild(label);

          container.appendChild(wrap);
        }
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      for (let pn = 1; pn <= numPages; pn++) {
        const page = await pdf.getPage(pn);
        const canvas = document.getElementById(`pdf-canvas-page-${pn}`) as HTMLCanvasElement;
        if (!canvas) continue;

        const unscaledVp = page.getViewport({ scale: 1.0 });
        const targetWidth = Math.min(760, container.clientWidth || 760);
        const scale = (targetWidth / unscaledVp.width) * dpr;
        const viewport = page.getViewport({ scale });

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      }
    } catch (err) {
      console.warn('PDF.js render error', err);
    }
  }

  private clearCanvasPages() {
    const container = document.getElementById('pdfPagesHost');
    if (container) container.innerHTML = '';
    this.hasCanvasRendered = false;
  }

  private leadDbFields = [
    'companyName', 'contactName', 'contactNumber', 'email',
    'dateOfIncorporation', 'companyEmail', 'authorisedCapital',
    'paidUpCapital', 'companyType', 'classOfCompany',
    'companyOrigin', 'roc', 'directorFirstName', 'directorLastName',
    'directorMobileNumber', 'directorEmailAddress', 'cin',
    'totalObligationOfContribution', 'addressType', 'streetAddressLine1',
    'streetAddressLine2', 'city', 'state', 'postalCode', 'registrationNumber'
  ];

  private isStandardField(key: string): boolean {
    const normalizedKey = key.toLowerCase();
    return this.leadDbFields.some(f => f.toLowerCase() === normalizedKey);
  }

  private getStandardFieldValue(key: string): string {
    if (!this.lead) return '';
    const normalizedKey = key.toLowerCase();
    const exactKey = this.leadDbFields.find(f => f.toLowerCase() === normalizedKey);
    
    if (exactKey) {
      if (exactKey === 'companyName') return this.lead.leadCompanyName || this.lead.companyName || '';
      if (exactKey === 'contactName') return this.lead[exactKey] || this.lead.name || '';
      if (exactKey === 'contactNumber') return this.lead[exactKey] || this.lead.phone || '';
      if (exactKey === 'email') return this.lead.directorEmailAddress || this.lead.companyEmail || this.lead.email || '';
      return this.lead[exactKey] || '';
    }
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
      for (const dp of this.dropdownPlaceholders) {
        dynamicData[dp.key] = dp.value;
      }

      const blob = await this.pdfSvc.generatePdfBlob(this.getPagesWithEdits(), tpl.name, dynamicData);

      if (action === 'download') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tpl.name}_${this.lead?.name || 'Lead'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.onProposalSent.emit({ action: 'download', templateName: tpl.name });
      } else if (action === 'send') {
        const fileName = `${tpl.name}_${this.lead?.name || 'Lead'}.pdf`;
        const file = new File([blob], fileName, { type: 'application/pdf' });
        this.onProposalSent.emit({ action: 'send', file, templateName: tpl.name });
      }

    } catch (e: any) {
      console.error(e);
      this.error = 'Failed to generate PDF: ' + e.message;
    } finally {
      this.generating = false;
    }
  }
}
