import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { NgIf, NgFor, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { AdminWorkspaceSectionProxy } from '../../sections/admin-workspace-section-proxy';
import Konva from 'konva';

declare const pdfjsLib: any;

export interface ProposalLayer {
  id: string;
  type: 'text' | 'image' | 'shape' | 'pdf_page';
  x: number; y: number; w: number; h: number;
  zIndex: number; locked: boolean; hidden: boolean;
  content?: string; fontSize?: number; fontFamily?: string; color?: string;
  bold?: boolean; italic?: boolean; underline?: boolean; align?: 'left' | 'center' | 'right';
  lineHeight?: number; letterSpacing?: number;
  isPlaceholder?: boolean; placeholderLabel?: string; placeholderMaxChars?: number; placeholderDropdownOptions?: string[];
  src?: string;        // display-size preview PNG (for Konva editor only)
  shapeType?: 'rect' | 'circle' | 'line';
  fillColor?: string; strokeColor?: string; strokeWidth?: number; borderRadius?: number; padding?: number;
}

export interface ProposalPage {
  id: string;
  layers: ProposalLayer[];
  /** Raw PDF bytes (base64) for the source PDF, used for lossless vector export */
  rawPdfBase64?: string;
  /** 0-based page index within the source PDF */
  rawPdfPageIndex?: number;
}

const A4_W = 794;
const A4_H = 1123;
// Standard A4 in PDF points (72 dpi)
const A4_PTS_W = 595.28;
const A4_PTS_H = 841.89;

@Component({
  selector: 'app-proposal-settings-section',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, FormsModule],
  templateUrl: './proposal-settings-section.component.html',
  styleUrls: ['./proposal-settings-section.component.css'],
})
export class ProposalSettingsSectionComponent extends AdminWorkspaceSectionProxy implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('konvaContainer') konvaContainer!: ElementRef<HTMLDivElement>;

  pages: ProposalPage[] = [{ id: 'page_1', layers: [] }];
  activePageIndex = 0;
  draggedPageIndex: number | null = null;
  dragOverPageIndex: number | null = null;
  selectedLayerId: string | null = null;
  templateName = 'Untitled Proposal';
  editingTemplateId: string | null = null;
  editorOpen = false;

  history: string[] = [];
  historyIndex = -1;
  private maxHistory = 40;

  openingTemplateId: string | null = null;
  draggedLayerId: string | null = null;
  editorZoom: number = 0.65;

  private stage!: Konva.Stage;
  private activeKonvaLayer!: Konva.Layer;
  private transformer!: Konva.Transformer;

  shapeSubtype: 'rect' | 'circle' | 'line' = 'rect';
  sidePanel: 'layers' | 'properties' = 'layers';

  propContent = ''; propContentSafe: any = ''; propFontSize = 16; propFontFamily = 'Inter'; propColor = '#000000';
  propBold = false; propItalic = false; propUnderline = false; propAlign: 'left' | 'center' | 'right' = 'left';
  propLineHeight = 1.2; propLetterSpacing = 0;
  propFillColor = '#e2e8f0'; propStrokeColor = '#475569'; propStrokeWidth = 2; propBorderRadius = 0; propPadding = 4;
  propHasBackground = false; propIsPlaceholder = false; propPlaceholderLabel = ''; propPlaceholderMode = ''; propPlaceholderMaxChars: number | null = null;
  propPlaceholderDropdownOptionsText = '';
  fontFamilies = ['Inter', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'];

  leadDbFields = [
    'companyName', 'contactName', 'contactNumber', 'email',
    'dateOfIncorporation', 'companyEmail', 'authorisedCapital',
    'paidUpCapital', 'companyType', 'classOfCompany',
    'companyOrigin', 'roc', 'directorFirstName', 'directorLastName',
    'directorMobileNumber', 'directorEmailAddress', 'cin',
    'totalObligationOfContribution', 'addressType', 'streetAddressLine1',
    'streetAddressLine2', 'city', 'state', 'postalCode', 'registrationNumber'
  ];

  constructor(public sanitizer: DomSanitizer) { super(); }
  override ngOnInit(): void {}
  ngAfterViewInit(): void {}

  get activePage(): ProposalPage { return this.pages[this.activePageIndex] ?? this.pages[0]; }
  get selectedLayer(): ProposalLayer | undefined { return this.activePage.layers.find(l => l.id === this.selectedLayerId); }
  get sortedLayers(): ProposalLayer[] { return [...this.activePage.layers].sort((a, b) => b.zIndex - a.zIndex); }

  initStage(): void {
    if (!this.konvaContainer?.nativeElement) return;
    if (this.stage) this.stage.destroy();
    // Use devicePixelRatio so the canvas is crisp on retina/HiDPI screens
    const dpr = window.devicePixelRatio || 2;
    this.stage = new Konva.Stage({
      container: this.konvaContainer.nativeElement,
      width: A4_W * this.editorZoom, height: A4_H * this.editorZoom,
      pixelRatio: dpr
    });
    this.stage.scale({ x: this.editorZoom, y: this.editorZoom });
    this.activeKonvaLayer = new Konva.Layer();
    this.stage.add(this.activeKonvaLayer);
    this.transformer = new Konva.Transformer({ rotateEnabled: false, keepRatio: false });
    this.activeKonvaLayer.add(this.transformer);
    this.stage.on('click tap', (e: any) => { if (e.target === this.stage) this.deselectLayer(); });
    this.renderCurrentPage();
  }

  renderCurrentPage(): void {
    if (!this.stage) return;
    this.activeKonvaLayer.destroyChildren();

    this.activeKonvaLayer.add(new Konva.Rect({ x: 0, y: 0, width: A4_W, height: A4_H, fill: '#ffffff', listening: false }));
    [...this.activePage.layers].sort((a, b) => a.zIndex - b.zIndex).forEach(layer => {
      if (!layer.hidden) this.addKonvaNode(layer);
    });

    this.transformer = new Konva.Transformer({ rotateEnabled: false, keepRatio: false });
    this.activeKonvaLayer.add(this.transformer);
    this.transformer.moveToTop();

    if (this.selectedLayerId) {
      const n = this.activeKonvaLayer.findOne('#' + this.selectedLayerId);
      if (n) this.transformer.nodes([n as any]);
    }

    this.activeKonvaLayer.draw();
  }

  private addKonvaNode(layer: ProposalLayer): void {
    let node: any;
    if (layer.type === 'text') {
      const pad = layer.padding !== undefined ? layer.padding : 4;
      node = new Konva.Group({ id: layer.id, x: layer.x, y: layer.y, width: layer.w, height: layer.h, draggable: !layer.locked });
      node.add(new Konva.Rect({
        name: 'bg', width: layer.w, height: layer.h,
        fill: layer.fillColor || 'transparent',
        cornerRadius: layer.borderRadius || 0
      }));
      node.add(new Konva.Text({
        name: 'txt', width: layer.w, height: layer.h,
        text: layer.isPlaceholder ? `[${layer.placeholderLabel || 'Placeholder'}]` : (layer.content || 'Text'),
        fontSize: layer.fontSize || 16, fontFamily: layer.fontFamily || 'Inter',
        fill: layer.color || '#000000',
        fontStyle: `${layer.bold ? 'bold' : ''} ${layer.italic ? 'italic' : ''}`.trim() || 'normal',
        align: layer.align || 'left', verticalAlign: 'top', padding: layer.padding !== undefined ? layer.padding : 4,
        lineHeight: layer.lineHeight || 1.2,
        opacity: 0 // Invisible so HTML overlay shows instead
      }));
    } else if (layer.type === 'image' || layer.type === 'pdf_page') {
      const img = new Image(); img.src = layer.src || '';
      node = new Konva.Image({ id: layer.id, x: layer.x, y: layer.y, width: layer.w, height: layer.h, image: img, draggable: !layer.locked });
      img.onload = () => this.activeKonvaLayer.draw();
    } else {
      if (layer.shapeType === 'circle') {
        node = new Konva.Ellipse({ id: layer.id, x: layer.x + layer.w / 2, y: layer.y + layer.h / 2, radiusX: layer.w / 2, radiusY: layer.h / 2, fill: layer.fillColor || 'transparent', stroke: layer.strokeColor || '#475569', strokeWidth: layer.strokeWidth || 2, draggable: !layer.locked });
      } else if (layer.shapeType === 'line') {
        node = new Konva.Line({ id: layer.id, x: layer.x, y: layer.y, points: [0, 0, layer.w, 0], stroke: layer.strokeColor || '#475569', strokeWidth: layer.strokeWidth || 2, draggable: !layer.locked });
      } else {
        node = new Konva.Rect({ id: layer.id, x: layer.x, y: layer.y, width: layer.w, height: layer.h, fill: layer.fillColor || 'transparent', stroke: layer.strokeColor || '#475569', strokeWidth: layer.strokeWidth || 2, cornerRadius: layer.borderRadius || 0, draggable: !layer.locked });
      }
    }
    node.on('click tap', () => this.selectLayer(layer.id));
    node.on('dragend', () => { const l = this.activePage.layers.find(x => x.id === layer.id); if (l) { this.pushHistory(); l.x = Math.round(node.x()); l.y = Math.round(node.y()); } });
    node.on('transformend', () => { const l = this.activePage.layers.find(x => x.id === layer.id); if (l) { this.pushHistory(); l.x = Math.round(node.x()); l.y = Math.round(node.y()); l.w = Math.round(node.width() * node.scaleX()); l.h = Math.round(node.height() * node.scaleY()); node.scaleX(1); node.scaleY(1); node.width(l.w); node.height(l.h); if (layer.type === 'text') { const bg = node.findOne('.bg'); if (bg) { bg.width(l.w); bg.height(l.h); } const txt = node.findOne('.txt'); if (txt) { txt.width(l.w); txt.height(l.h); } } if (this.selectedLayerId === layer.id) this.syncPropsFromLayer(); } });
    this.activeKonvaLayer.add(node);
    this.activeKonvaLayer.draw();
  }

  selectLayer(id: string): void {
    this.selectedLayerId = id;
    const n = this.activeKonvaLayer.findOne(`#${id}`);
    if (n) this.transformer.nodes([n as any]);
    this.activeKonvaLayer.draw();
    this.sidePanel = 'properties';
    this.syncPropsFromLayer();
  }

  deselectLayer(): void {
    this.selectedLayerId = null;
    this.transformer?.nodes([]);
    this.activeKonvaLayer?.draw();
    this.sidePanel = 'layers';
  }

  @ViewChild('editorArea') editorArea!: import('@angular/core').ElementRef<HTMLDivElement>;

  syncPropsFromLayer(): void {
    const l = this.selectedLayer; if (!l) return;
    this.propContent = l.content || ''; 
    setTimeout(() => {
      if (this.editorArea && this.editorArea.nativeElement.innerHTML !== this.propContent) {
        this.editorArea.nativeElement.innerHTML = this.propContent;
      }
    });
    this.propFontSize = l.fontSize || 16; this.propFontFamily = l.fontFamily || 'Inter';
    this.propColor = l.color || '#000000'; this.propBold = l.bold || false; this.propItalic = l.italic || false;
    this.propUnderline = l.underline || false; this.propAlign = l.align || 'left';
    this.propLineHeight = l.lineHeight || 1.2; this.propLetterSpacing = l.letterSpacing || 0;
    if (!l.fillColor || l.fillColor === 'transparent') {
      this.propHasBackground = false;
      this.propFillColor = '#ffffff';
    } else {
      this.propHasBackground = true;
      this.propFillColor = l.fillColor;
    }
    this.propStrokeColor = l.strokeColor || '#475569';
    this.propStrokeWidth = l.strokeWidth !== undefined ? l.strokeWidth : 2; 
    this.propBorderRadius = l.borderRadius !== undefined ? l.borderRadius : 0;
    this.propPadding = l.padding !== undefined ? l.padding : 4;
    this.propIsPlaceholder = l.isPlaceholder || false; 
    this.propPlaceholderLabel = l.placeholderLabel || '';
    this.propPlaceholderMaxChars = l.placeholderMaxChars || null;
    this.propPlaceholderDropdownOptionsText = (l.placeholderDropdownOptions || []).join(', ');
    
    if (l.placeholderDropdownOptions) {
      this.propPlaceholderMode = 'dropdown';
    } else if (this.propPlaceholderLabel) {
      this.propPlaceholderMode = this.leadDbFields.includes(this.propPlaceholderLabel) ? this.propPlaceholderLabel : 'custom';
    } else if (this.propPlaceholderMode !== 'custom' && this.propPlaceholderMode !== 'dropdown') {
      this.propPlaceholderMode = '';
    }
  }

  private safeHtmlCache = new Map<string, any>();

  getLayerSafeHtml(layer: any): any {
    const raw = layer.isPlaceholder ? `[${layer.placeholderLabel || 'Placeholder'}]` : (layer.content || 'Text');
    const cacheKey = layer.id + '_' + raw;
    if (this.safeHtmlCache.has(cacheKey)) return this.safeHtmlCache.get(cacheKey);
    const safe = this.sanitizer.bypassSecurityTrustHtml(raw);
    this.safeHtmlCache.set(cacheKey, safe);
    return safe;
  }

  onPlaceholderModeChange(): void {
    if (this.propPlaceholderMode !== 'custom' && this.propPlaceholderMode !== 'dropdown') {
      this.propPlaceholderLabel = this.propPlaceholderMode;
    } else {
      this.propPlaceholderLabel = '';
    }
    this.applyProps();
  }

  execFormat(command: string, event?: any) {
    let value = null;
    if (event && event.target) {
      value = event.target.value;
    }
    document.execCommand(command, false, value);
    if (this.editorArea) {
      this.propContent = this.editorArea.nativeElement.innerHTML;
      this.applyProps();
    }
  }

  onContentChange(event: any) {
    this.propContent = event.target.innerHTML;
    this.applyProps();
  }

  applyProps(): void {
    const l = this.selectedLayer; if (!l) return;
    this.pushHistory();
    const finalFillColor = this.propHasBackground ? this.propFillColor : 'transparent';
    if (l.type === 'text') {
      const isCustomOrDropdown = this.propPlaceholderMode === 'custom' || this.propPlaceholderMode === 'dropdown';
      const finalPlaceholderLabel = isCustomOrDropdown ? this.propPlaceholderLabel : this.propPlaceholderMode;
      const dropdownOptions = this.propPlaceholderMode === 'dropdown' 
        ? this.propPlaceholderDropdownOptionsText.split(',').map(s => s.trim()).filter(s => !!s)
        : undefined;

      Object.assign(l, { content: this.propContent, fontSize: this.propFontSize, fontFamily: this.propFontFamily, color: this.propColor, bold: this.propBold, italic: this.propItalic, underline: this.propUnderline, align: this.propAlign, lineHeight: this.propLineHeight, letterSpacing: this.propLetterSpacing, isPlaceholder: this.propIsPlaceholder, placeholderLabel: finalPlaceholderLabel, placeholderMaxChars: this.propPlaceholderMaxChars, placeholderDropdownOptions: dropdownOptions, fillColor: finalFillColor, borderRadius: this.propBorderRadius, padding: this.propPadding });
      if (l.isPlaceholder) {
        this.autoFitText();
        return; // autoFitText already calls renderCurrentPage
      }
    } else if (l.type === 'shape') {
      Object.assign(l, { fillColor: finalFillColor, strokeColor: this.propStrokeColor, strokeWidth: this.propStrokeWidth, borderRadius: this.propBorderRadius });
    }
    this.renderCurrentPage();
    if (this.selectedLayerId) setTimeout(() => this.selectLayer(this.selectedLayerId!), 10);
  }

  autoFitText(): void {
    const l = this.selectedLayer;
    if (!l || l.type !== 'text') return;
    this.pushHistory();

    const tempText = new Konva.Text({
        text: l.isPlaceholder ? `[${l.placeholderLabel || 'Placeholder'}]` : (l.content || 'Text'),
        fontSize: l.fontSize || 16, fontFamily: l.fontFamily || 'Inter',
        fontStyle: `${l.bold ? 'bold' : ''} ${l.italic ? 'italic' : ''}`.trim() || 'normal',
        padding: l.padding !== undefined ? l.padding : 4,
    });
    
    l.w = tempText.width();
    l.h = tempText.height();
    this.renderCurrentPage();
    if (this.selectedLayerId) setTimeout(() => this.selectLayer(this.selectedLayerId!), 10);
  }

  private newId(): string { return 'layer_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  private maxZ(): number { const z = this.activePage.layers.map(l => l.zIndex); return z.length ? Math.max(...z) + 1 : 1; }

  addTextLayer(isPlaceholder = false): void {
    this.pushHistory();
    const layer: ProposalLayer = { id: this.newId(), type: 'text', x: 80, y: 80, w: 300, h: 60, zIndex: this.maxZ(), locked: false, hidden: false, content: isPlaceholder ? '' : 'Click to edit text', fontSize: 16, fontFamily: 'Inter', color: '#1e293b', bold: false, italic: false, underline: false, align: 'left', isPlaceholder, placeholderLabel: isPlaceholder ? 'Enter text' : '' };
    this.activePage.layers.push(layer);
    this.renderCurrentPage();
    setTimeout(() => this.selectLayer(layer.id), 50);
  }

  addShapeLayer(): void {
    this.pushHistory();
    const layer: ProposalLayer = { id: this.newId(), type: 'shape', x: 100, y: 100, w: 200, h: 100, zIndex: this.maxZ(), locked: false, hidden: false, shapeType: this.shapeSubtype, fillColor: '#e2e8f0', strokeColor: '#475569', strokeWidth: 2, borderRadius: 0 };
    this.activePage.layers.push(layer);
    this.renderCurrentPage();
    setTimeout(() => this.selectLayer(layer.id), 50);
  }

  onImageUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        this.pushHistory();
        let w = img.width;
        let h = img.height;
        if (w > 600) { h = Math.round((600 / w) * h); w = 600; }
        const layer: ProposalLayer = { id: this.newId(), type: 'image', x: 80, y: 80, w, h, zIndex: this.maxZ(), locked: false, hidden: false, src };
        this.activePage.layers.push(layer);
        this.renderCurrentPage();
        setTimeout(() => this.selectLayer(layer.id), 50);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    (event.target as HTMLInputElement).value = '';
  }

  // ── PDF Import ─────────────────────────────────────────────────────────────
  // Renders a lightweight screen-res preview for the Konva canvas editor,
  // and stores the original raw PDF bytes (base64) at the page level so
  // exportToPdf() can embed the content as a vector XObject (zero quality loss).
  onPdfImport(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    (event.target as HTMLInputElement).value = '';
    if (typeof pdfjsLib === 'undefined') { alert('PDF.js is loading, please retry.'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawBuffer = e.target?.result as ArrayBuffer;
      // Store raw bytes as base64 for lossless vector export
      const rawPdfBase64 = this.arrayBufferToBase64(rawBuffer);
      const data = new Uint8Array(rawBuffer);
      try {
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        for (let pn = 1; pn <= pdf.numPages; pn++) {
          const pg = await pdf.getPage(pn);
          // Render preview at 2× for crisp display on HiDPI/retina screens
          const displayDpr = Math.max(window.devicePixelRatio || 2, 2);
          const previewScale = (A4_W / pg.getViewport({ scale: 1 }).width) * displayDpr;
          const vp = pg.getViewport({ scale: previewScale });
          const c = document.createElement('canvas');
          c.width  = Math.round(vp.width);
          c.height = Math.round(vp.height);
          await pg.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise;
          const srcPreview = c.toDataURL('image/png');

          if (pn > 1) this.addPage();
          const target = this.pages[this.activePageIndex + pn - 1] ?? this.pages[this.pages.length - 1];

          // Store raw PDF bytes at page level (not in layer — stays out of the saved template JSON)
          target.rawPdfBase64 = rawPdfBase64;
          target.rawPdfPageIndex = pn - 1;

          this.pushHistory();
          target.layers.unshift({
            id: this.newId(), type: 'pdf_page',
            x: 0, y: 0, w: A4_W, h: A4_H,
            zIndex: 0, locked: true, hidden: false,
            src: srcPreview,  // preview for canvas editor only
          });
        }
        this.renderCurrentPage();
      } catch (err) { console.error(err); alert('Failed to import PDF.'); }
    };
    reader.readAsArrayBuffer(file);
  }

  useCompanyLogo(): void {
    const logo = (this as any).settingsInvoiceLogo;
    if (!logo) { alert('No logo found in Invoice Settings.'); return; }
    this.pushHistory();
    const layer: ProposalLayer = { id: this.newId(), type: 'image', x: 40, y: 30, w: 160, h: 60, zIndex: this.maxZ(), locked: false, hidden: false, src: logo };
    this.activePage.layers.push(layer);
    this.renderCurrentPage();
    setTimeout(() => this.selectLayer(layer.id), 50);
  }

  deleteSelectedLayer(): void {
    if (!this.selectedLayerId) return;
    const l = this.activePage.layers.find(x => x.id === this.selectedLayerId);
    if (l?.locked) return;
    this.pushHistory();
    this.activePage.layers = this.activePage.layers.filter(x => x.id !== this.selectedLayerId);
    this.deselectLayer(); this.renderCurrentPage();
  }

  moveLayerUp(): void { const l = this.activePage.layers.find(x => x.id === this.selectedLayerId); if (!l) return; this.pushHistory(); const maxZ = Math.max(...this.activePage.layers.map(x => x.zIndex)); if (l.zIndex < maxZ) l.zIndex++; this.renderCurrentPage(); }
  moveLayerDown(): void { const l = this.activePage.layers.find(x => x.id === this.selectedLayerId); if (!l) return; this.pushHistory(); if (l.zIndex > 0) l.zIndex--; this.renderCurrentPage(); }

  onLayerDragStart(event: DragEvent, id: string): void {
    this.draggedLayerId = id;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
    }
  }

  onLayerDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  onLayerDrop(event: DragEvent, targetId: string): void {
    event.preventDefault();
    if (!this.draggedLayerId || this.draggedLayerId === targetId) return;

    this.pushHistory();
    const layers = this.sortedLayers;
    const draggedIndex = layers.findIndex(l => l.id === this.draggedLayerId);
    const targetIndex = layers.findIndex(l => l.id === targetId);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [draggedLayer] = layers.splice(draggedIndex, 1);
      layers.splice(targetIndex, 0, draggedLayer);
      
      let z = layers.length * 10;
      for (const l of layers) {
        l.zIndex = z;
        z -= 10;
      }
    }
    
    this.draggedLayerId = null;
    this.renderCurrentPage();
  }

  toggleLayerHidden(id: string): void { const l = this.activePage.layers.find(x => x.id === id); if (l) { l.hidden = !l.hidden; this.renderCurrentPage(); } if (this.selectedLayerId === id) this.deselectLayer(); }
  toggleLayerLocked(id: string): void { const l = this.activePage.layers.find(x => x.id === id); if (l) { l.locked = !l.locked; this.renderCurrentPage(); } }

  addPage(): void { this.pushHistory(); this.pages.push({ id: `page_${Date.now()}`, layers: [] }); this.switchPage(this.pages.length - 1); }
  switchPage(i: number): void { if (i < 0 || i >= this.pages.length) return; this.deselectLayer(); this.activePageIndex = i; this.renderCurrentPage(); }
  deletePage(i: number): void { if (this.pages.length <= 1) return; this.pushHistory(); this.pages.splice(i, 1); this.activePageIndex = Math.min(this.activePageIndex, this.pages.length - 1); this.renderCurrentPage(); }

  onPageDragStart(event: DragEvent, index: number): void {
    this.draggedPageIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onPageDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    this.dragOverPageIndex = index;
  }

  onPageDragLeave(): void {
    this.dragOverPageIndex = null;
  }

  onPageDrop(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    this.dragOverPageIndex = null;
    if (this.draggedPageIndex === null || this.draggedPageIndex === targetIndex) {
      this.draggedPageIndex = null;
      return;
    }

    this.pushHistory();
    const pageToMove = this.pages[this.draggedPageIndex];
    this.pages.splice(this.draggedPageIndex, 1);
    this.pages.splice(targetIndex, 0, pageToMove);

    // Track active page selection
    if (this.activePageIndex === this.draggedPageIndex) {
      this.activePageIndex = targetIndex;
    } else if (this.activePageIndex > this.draggedPageIndex && this.activePageIndex <= targetIndex) {
      this.activePageIndex--;
    } else if (this.activePageIndex < this.draggedPageIndex && this.activePageIndex >= targetIndex) {
      this.activePageIndex++;
    }

    this.draggedPageIndex = null;
    this.renderCurrentPage();
  }

  zoomIn(): void {
    if (this.editorZoom < 2.0) {
      this.editorZoom = Math.min(2.0, this.editorZoom + 0.1);
      this.updateZoom();
    }
  }

  zoomOut(): void {
    if (this.editorZoom > 0.3) {
      this.editorZoom = Math.max(0.3, this.editorZoom - 0.1);
      this.updateZoom();
    }
  }

  updateZoom(): void {
    if (!this.stage) return;
    this.stage.width(A4_W * this.editorZoom);
    this.stage.height(A4_H * this.editorZoom);
    this.stage.scale({ x: this.editorZoom, y: this.editorZoom });
    this.stage.draw();
  }

  pushHistory(): void {
    // Exclude rawPdfBase64 from history snapshots (too large)
    const snap = JSON.stringify(this.pages.map(p => ({ ...p, rawPdfBase64: undefined })));
    if (this.historyIndex < this.history.length - 1) this.history.splice(this.historyIndex + 1);
    this.history.push(snap);
    if (this.history.length > this.maxHistory) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }
  undo(): void { if (this.historyIndex <= 0) return; this.historyIndex--; const snap = JSON.parse(this.history[this.historyIndex]); this.pages.forEach((p, i) => { if (snap[i]) { snap[i].rawPdfBase64 = p.rawPdfBase64; snap[i].rawPdfPageIndex = p.rawPdfPageIndex; } }); this.pages = snap; this.deselectLayer(); this.renderCurrentPage(); }
  redo(): void { if (this.historyIndex >= this.history.length - 1) return; this.historyIndex++; const snap = JSON.parse(this.history[this.historyIndex]); this.pages.forEach((p, i) => { if (snap[i]) { snap[i].rawPdfBase64 = p.rawPdfBase64; snap[i].rawPdfPageIndex = p.rawPdfPageIndex; } }); this.pages = snap; this.deselectLayer(); this.renderCurrentPage(); }

  // ── PDF Export (vector quality via pdf-lib) ────────────────────────────────
  // For pages with an imported PDF background:
  //   → Embeds original PDF page as a Form XObject (100% vector, zero rasterisation)
  // For text layers:
  //   → Draws native PDF text using pdf-lib standard fonts (vector-sharp at any zoom)
  // For shapes:
  //   → Draws native PDF vector shapes
  // For raster images (PNG/JPG):
  //   → Embeds raw bytes, no re-compression
  async exportToPdf(): Promise<void> {
    try {
      const { PDFDocument, StandardFonts } = await import('pdf-lib');

      const doc = await PDFDocument.create();
      const SCALE_X = A4_PTS_W / A4_W;
      const SCALE_Y = A4_PTS_H / A4_H;

      for (const page of this.pages) {
        let pdfPage: any;

        // ── Background: embed original PDF page as vector XObject ──────────
        if (page.rawPdfBase64 && page.rawPdfPageIndex !== undefined) {
          const srcBytes = this.base64ToUint8Array(page.rawPdfBase64);
          const srcDoc  = await PDFDocument.load(srcBytes);
          const [xObj]  = await doc.embedPages([srcDoc.getPages()[page.rawPdfPageIndex]]);
          pdfPage = doc.addPage([A4_PTS_W, A4_PTS_H]);
          // Draw the embedded vector page scaled to fill A4
          pdfPage.drawPage(xObj, { x: 0, y: 0, width: A4_PTS_W, height: A4_PTS_H });
        } else {
          pdfPage = doc.addPage([A4_PTS_W, A4_PTS_H]);
          pdfPage.drawRectangle({ x: 0, y: 0, width: A4_PTS_W, height: A4_PTS_H, color: this.hexToRgbPdf('#ffffff') });
        }

        // ── Overlay layers (text, shapes, images) ─────────────────────────
        const overlays = [...page.layers]
          .filter(l => !l.hidden && l.type !== 'pdf_page')
          .sort((a, b) => a.zIndex - b.zIndex);

        for (const layer of overlays) {
          const lx  = layer.x * SCALE_X;
          // PDF Y: origin is bottom-left, so flip
          const ly  = A4_PTS_H - (layer.y + layer.h) * SCALE_Y;
          const lw  = layer.w * SCALE_X;
          const lh  = layer.h * SCALE_Y;

          if (layer.type === 'text') {
            if (layer.fillColor && layer.fillColor !== 'transparent') {
              pdfPage.drawRectangle({
                x: lx, y: ly, width: lw, height: lh,
                color: this.hexToRgbPdf(layer.fillColor)
              });
            }
            
            // Pick nearest standard font (all vector)
            const family = (layer.fontFamily || '').toLowerCase();
            const bold   = layer.bold;
            const italic = layer.italic;
            let fontKey: any;
            if (family.includes('times') || family.includes('georgia')) {
              fontKey = bold && italic ? StandardFonts.TimesRomanBoldItalic
                      : bold          ? StandardFonts.TimesRomanBold
                      : italic        ? StandardFonts.TimesRomanItalic
                      :                 StandardFonts.TimesRoman;
            } else if (family.includes('courier')) {
              fontKey = bold && italic ? StandardFonts.CourierBoldOblique
                      : bold          ? StandardFonts.CourierBold
                      : italic        ? StandardFonts.CourierOblique
                      :                 StandardFonts.Courier;
            } else {
              fontKey = bold && italic ? StandardFonts.HelveticaBoldOblique
                      : bold          ? StandardFonts.HelveticaBold
                      : italic        ? StandardFonts.HelveticaOblique
                      :                 StandardFonts.Helvetica;
            }
            const font      = await doc.embedFont(fontKey);
            const fontSize  = (layer.fontSize || 16) * SCALE_Y;
            const colorHex  = layer.color || '#000000';
            const color     = this.hexToRgbPdf(colorHex);
            let rawText = layer.isPlaceholder
              ? `[${layer.placeholderLabel || 'Placeholder'}]`
              : (layer.content || '');
            
            // Basic HTML to plaintext conversion
            rawText = rawText
              .replace(/<br\s*[\/]?>/gi, '\n')
              .replace(/<\/p>|<\/div>/gi, '\n')
              .replace(/<[^>]+>/g, '')
              .replace(/\n\s*\n/g, '\n')
              .trim();
              
            const text = rawText;

            // Word-wrap and draw line by line
            const padX = (layer.padding !== undefined ? layer.padding : 4) * SCALE_X;
            const padY = (layer.padding !== undefined ? layer.padding : 4) * SCALE_Y;
            const maxW = lw - padX * 2;
            const lines = this.wrapTextForPdf(text, font, fontSize, maxW);
            const lineH = fontSize * 1.3;
            const baselineOffset = font.heightAtSize(fontSize, { descender: false });
            let textY   = ly + lh - padY - baselineOffset; // top-down inside box
            for (const line of lines) {
              if (textY < ly) break;
              let drawX = lx + padX;
              if (layer.align === 'center') drawX = lx + (lw - font.widthOfTextAtSize(line, fontSize)) / 2;
              if (layer.align === 'right')  drawX = lx + lw - font.widthOfTextAtSize(line, fontSize) - padX;
              pdfPage.drawText(line, { x: drawX, y: textY, size: fontSize, font, color });
              textY -= lineH;
            }

          } else if (layer.type === 'shape') {
            const fill   = layer.fillColor && layer.fillColor !== 'transparent' ? this.hexToRgbPdf(layer.fillColor) : undefined;
            const stroke = this.hexToRgbPdf(layer.strokeColor || '#475569');
            const sw     = (layer.strokeWidth || 2) * Math.min(SCALE_X, SCALE_Y);
            if (layer.shapeType === 'circle') {
              pdfPage.drawEllipse({ x: lx + lw/2, y: ly + lh/2, xScale: lw/2, yScale: lh/2, color: fill, borderColor: stroke, borderWidth: sw, opacity: fill ? 1 : 0, borderOpacity: 1 });
            } else if (layer.shapeType === 'line') {
              pdfPage.drawLine({ start: { x: lx, y: ly + lh/2 }, end: { x: lx + lw, y: ly + lh/2 }, thickness: sw, color: stroke });
            } else {
              pdfPage.drawRectangle({ x: lx, y: ly, width: lw, height: lh, color: fill, borderColor: stroke, borderWidth: sw, opacity: fill ? 1 : 0, borderOpacity: 1 });
            }

          } else if (layer.type === 'image' && layer.src) {
            try {
              const base64Data = layer.src.split(',')[1];
              const bytes      = this.base64ToUint8Array(base64Data);
              let embedded: any;
              if (layer.src.startsWith('data:image/png')) {
                embedded = await doc.embedPng(bytes);
              } else {
                embedded = await doc.embedJpg(bytes);
              }
              pdfPage.drawImage(embedded, { x: lx, y: ly, width: lw, height: lh });
            } catch (e) { console.warn('Could not embed image layer', e); }
          }
        }
      }

      const bytes = await doc.save();
      const blob  = new Blob([bytes as any], { type: 'application/pdf' });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a');
      a.href = url; a.download = `${this.templateName || 'proposal'}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err) { console.error(err); alert('PDF export failed.'); }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Directly constructs the {type:'RGB', red, green, blue} object that pdf-lib expects
  // No need to pass the rgb function — we replicate its exact output format
  private hexToRgbPdf(hex: string): { type: string; red: number; green: number; blue: number } {
    const clean = (hex || '#000000').replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return { type: 'RGB', red: isNaN(r) ? 0 : r, green: isNaN(g) ? 0 : g, blue: isNaN(b) ? 0 : b };
  }

  private wrapTextForPdf(text: string, font: any, fontSize: number, maxWidth: number): string[] {
    const rawLines = text.split(/\r?\n/);
    const lines: string[] = [];
    for (const rawLine of rawLines) {
      const words = rawLine.split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, fontSize) > maxWidth && line) {
          lines.push(line); line = word;
        } else { line = test; }
      }
      if (line) lines.push(line);
      else if (!words.length || (words.length === 1 && words[0] === '')) lines.push('');
    }
    return lines;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary  = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...(bytes.subarray(i, i + chunk) as any));
    }
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async saveTemplate(): Promise<void> {
    await (this as any).saveProposalTemplate({ _id: this.editingTemplateId, name: this.templateName, pages: this.pages });
  }

  async enterEditor(template?: any): Promise<void> {
    if (template) {
      this.openingTemplateId = template._id;
      try {
        const fullTemplate = await (this as any).fetchProposalTemplateById(template._id);
        this.editingTemplateId = fullTemplate._id;
        this.templateName = fullTemplate.name;
        this.pages = JSON.parse(JSON.stringify(fullTemplate.pages || [{ id: 'page_1', layers: [] }]));
      } catch (err) {
        console.error('Failed to load full template', err);
        alert('Failed to load template details.');
        this.openingTemplateId = null;
        return;
      }
      this.openingTemplateId = null;
    } else {
      this.editingTemplateId = null; this.templateName = 'Untitled Proposal';
      this.pages = [{ id: 'page_1', layers: [] }];
    }
    this.activePageIndex = 0; this.history = []; this.historyIndex = -1; this.pushHistory();
    this.editorOpen = true;
    setTimeout(() => this.initStage(), 80);
  }

  async exitEditor(): Promise<void> {
    const wantsToSave = window.confirm('Do you want to save this template as a draft before leaving?\n\n(Click OK to save and leave, or Cancel to leave without saving)');
    if (wantsToSave) {
      await this.saveTemplate();
    }

    this.editorOpen = false; this.deselectLayer();
    if (this.stage) { this.stage.destroy(); this.stage = null as any; }
    (this as any).fetchProposalTemplates();
  }

  ngOnDestroy(): void { if (this.stage) this.stage.destroy(); }

  layerLabel(layer: ProposalLayer): string {
    if (layer.type === 'text') return layer.isPlaceholder ? `[${layer.placeholderLabel || 'Placeholder'}]` : `"${(layer.content || '').slice(0, 18)}"`;
    if (layer.type === 'image') return 'Image';
    if (layer.type === 'pdf_page') return 'PDF Page';
    return `${layer.shapeType || 'Shape'}`;
  }

  getPageThumbnail(page: ProposalPage): string | null {
    if (!page?.layers) return null;
    const pdfLayer = page.layers.find(l => l.type === 'pdf_page');
    if (pdfLayer && pdfLayer.src) return pdfLayer.src;
    const imgLayer = page.layers.find(l => l.type === 'image');
    if (imgLayer && imgLayer.src) return imgLayer.src;
    return null;
  }
}
