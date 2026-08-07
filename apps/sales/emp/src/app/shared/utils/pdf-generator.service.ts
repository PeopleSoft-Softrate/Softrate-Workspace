import { Injectable } from '@angular/core';

const A4_W = 794; const A4_H = 1123;
const A4_PTS_W = 595.28; const A4_PTS_H = 841.89;

@Injectable({
  providedIn: 'root'
})
export class PdfGeneratorService {

  constructor() { }

  /**
   * Generates a PDF from the given pages.
   * Replaces any text placeholder with the provided dynamic data.
   */
  async generatePdfBlob(pages: any[], templateName: string, dynamicData: Record<string, string>): Promise<Blob> {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const SCALE_X = A4_PTS_W / A4_W;
    const SCALE_Y = A4_PTS_H / A4_H;

    for (const page of pages) {
      let pdfPage: any;

      if (page.rawPdfBase64 && page.rawPdfPageIndex !== undefined) {
        const srcBytes = this.base64ToUint8Array(page.rawPdfBase64);
        const srcDoc  = await PDFDocument.load(srcBytes);
        const [xObj]  = await doc.embedPages([srcDoc.getPages()[page.rawPdfPageIndex]]);
        pdfPage = doc.addPage([A4_PTS_W, A4_PTS_H]);
        pdfPage.drawPage(xObj, { x: 0, y: 0, width: A4_PTS_W, height: A4_PTS_H });
      } else {
        pdfPage = doc.addPage([A4_PTS_W, A4_PTS_H]);
        pdfPage.drawRectangle({ x: 0, y: 0, width: A4_PTS_W, height: A4_PTS_H, color: this.hexToRgbPdf('#ffffff') });
      }

      const overlays = [...page.layers]
        .filter((l: any) => !l.hidden && l.type !== 'pdf_page')
        .sort((a: any, b: any) => a.zIndex - b.zIndex);

      for (const layer of overlays) {
        const lx  = layer.x * SCALE_X;
        const ly  = A4_PTS_H - (layer.y + layer.h) * SCALE_Y;
        const lw  = layer.w * SCALE_X;
        const lh  = layer.h * SCALE_Y;

        if (layer.type === 'text') {
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
          
          let text = layer.content || '';
          if (layer.isPlaceholder) {
            const key = layer.placeholderLabel || 'Placeholder';
            text = dynamicData[key] !== undefined ? dynamicData[key] : `[${key}]`;
          }

          const padX = (layer.padding !== undefined ? layer.padding : 4) * SCALE_X;
          const padY = (layer.padding !== undefined ? layer.padding : 4) * SCALE_Y;
          const maxW = lw - padX * 2;
          const lines = this.wrapTextForPdf(text, font, fontSize, maxW);
          const lineH = fontSize * 1.3;
          
          let actualTextWidth = 0;
          for (const line of lines) {
             const w = font.widthOfTextAtSize(line, fontSize);
             if (w > actualTextWidth) actualTextWidth = w;
          }
          const actualTextHeight = lines.length * lineH;
          
          let bgX = lx;
          let bgY = ly;
          let bgW = lw;
          let bgH = lh;
          
          if (layer.isPlaceholder) {
            bgW = actualTextWidth + padX * 2;
            bgH = actualTextHeight + padY * 2;
            bgY = ly + lh - bgH; // Keep top edge fixed
            
            if (layer.align === 'center') {
              bgX = lx + (lw - bgW) / 2;
            } else if (layer.align === 'right') {
              bgX = lx + lw - bgW;
            }
          }

          if (layer.fillColor && layer.fillColor !== 'transparent') {
            const r = layer.borderRadius ? layer.borderRadius * Math.min(SCALE_X, SCALE_Y) : 0;
            if (r > 0) {
              this.drawRoundedRect(pdfPage, bgX, bgY, bgW, bgH, r, this.hexToRgbPdf(layer.fillColor));
            } else {
              pdfPage.drawRectangle({
                x: bgX, y: bgY, width: bgW, height: bgH,
                color: this.hexToRgbPdf(layer.fillColor)
              });
            }
          }
          const baselineOffset = font.heightAtSize(fontSize, { descender: false });
          let textY = ly + lh - padY - baselineOffset; 
          for (const line of lines) {
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
            const r = layer.borderRadius ? layer.borderRadius * Math.min(SCALE_X, SCALE_Y) : 0;
            if (r > 0) {
              this.drawRoundedRect(pdfPage, lx, ly, lw, lh, r, fill, stroke, sw);
            } else {
              pdfPage.drawRectangle({ x: lx, y: ly, width: lw, height: lh, color: fill, borderColor: stroke, borderWidth: sw, opacity: fill ? 1 : 0, borderOpacity: 1 });
            }
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
    return new Blob([bytes as any], { type: 'application/pdf' });
  }

  private hexToRgbPdf(hex: string): { type: string; red: number; green: number; blue: number } {
    const clean = (hex || '#000000').replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return { type: 'RGB', red: isNaN(r) ? 0 : r, green: isNaN(g) ? 0 : g, blue: isNaN(b) ? 0 : b };
  }

  private drawRoundedRect(page: any, x: number, y: number, w: number, h: number, r: number, color?: any, borderColor?: any, borderWidth?: number) {
    const cr = Math.max(0, Math.min(r, w / 2, h / 2));
    const k = 0.5522847498;
    const kr = k * cr;
    const path = `M ${cr},0 L ${w-cr},0 C ${w-cr+kr},0 ${w},${cr-kr} ${w},${cr} L ${w},${h-cr} C ${w},${h-cr+kr} ${w-cr+kr},${h} ${w-cr},${h} L ${cr},${h} C ${cr-kr},${h} 0,${h-cr+kr} 0,${h-cr} L 0,${cr} C 0,${cr-kr} ${cr-kr},0 ${cr},0 Z`;
    const options: any = { x, y: y + h };
    if (color) options.color = color;
    if (borderColor) options.borderColor = borderColor;
    if (borderWidth) options.borderWidth = borderWidth;
    page.drawSvgPath(path, options);
  }

  private wrapTextForPdf(text: string, font: any, fontSize: number, maxWidth: number): string[] {
    const words  = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && line) {
        lines.push(line); line = word;
      } else { line = test; }
    }
    if (line) lines.push(line);
    return lines;
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
}
