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
        const layerX = Number(layer.x) || 0;
        const layerY = Number(layer.y) || 0;
        const layerW = Math.max(10, Number(layer.w) || 300);
        const layerH = Math.max(10, Number(layer.h) || 100);

        const lx  = layerX * SCALE_X;
        const ly  = A4_PTS_H - (layerY + layerH) * SCALE_Y;
        const lw  = layerW * SCALE_X;
        const lh  = layerH * SCALE_Y;

        if (layer.type === 'text') {
          const family = (layer.fontFamily || '').toLowerCase();
          const bold   = layer.bold;
          const italic = layer.italic;
          let regFontKey: any;
          let boldFontKey: any;
          if (family.includes('times') || family.includes('georgia')) {
            regFontKey  = italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman;
            boldFontKey = italic ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanBold;
          } else if (family.includes('courier')) {
            regFontKey  = italic ? StandardFonts.CourierOblique : StandardFonts.Courier;
            boldFontKey = italic ? StandardFonts.CourierBoldOblique : StandardFonts.CourierBold;
          } else {
            regFontKey  = italic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica;
            boldFontKey = italic ? StandardFonts.HelveticaBoldOblique : StandardFonts.HelveticaBold;
          }
          
          const regFont  = await doc.embedFont(regFontKey);
          const boldFont = await doc.embedFont(boldFontKey);
          const font = bold ? boldFont : regFont;
          const fontSize  = (Number(layer.fontSize) || 16) * SCALE_Y;
          const colorHex  = layer.color || '#000000';
          const color     = this.hexToRgbPdf(colorHex);
          
          let text = layer.content || '';
          if (layer.isPlaceholder) {
            const key = layer.placeholderLabel || 'Placeholder';
            text = dynamicData[key] !== undefined ? dynamicData[key] : `[${key}]`;

            if (layer.placeholderDropdownOptions && layer.placeholderDropdownOptions.length > 0) {
              try {
                const challenges = JSON.parse(text);
                if (Array.isArray(challenges) && challenges.length > 0) {
                  let cx = lx;
                  let cy = ly + lh;
                  
                  const pillPad = (layer.padding !== undefined ? layer.padding : 6);
                  const pillPadX = (pillPad + 4) * SCALE_X; // Slightly more horizontal padding looks better for pills
                  const pillPadY = pillPad * SCALE_Y;
                  
                  const pillR = (layer.borderRadius !== undefined ? layer.borderRadius : 14) * Math.min(SCALE_X, SCALE_Y);
                  const gap = 16 * Math.min(SCALE_X, SCALE_Y); // Increased spacing between pills
                  
                  const textH = font.heightAtSize(fontSize, { descender: false });
                  const pillH = textH + pillPadY * 2;
                  
                  const pillBgCol = layer.fillColor && layer.fillColor !== 'transparent' 
                    ? this.hexToRgbPdf(layer.fillColor) 
                    : this.hexToRgbPdf('#e0e7ff');

                  cy -= pillH;
                  
                  for (const ch of challenges) {
                    const chW = font.widthOfTextAtSize(ch, fontSize);
                    const pillW = chW + pillPadX * 2;
                    
                    if (cx + pillW > lx + lw && cx > lx) {
                      cx = lx;
                      cy -= (pillH + gap);
                    }
                    
                    if (pillR > 0) {
                      this.drawRoundedRect(pdfPage, cx, cy, pillW, pillH, pillR, pillBgCol);
                    } else {
                      pdfPage.drawRectangle({ x: cx, y: cy, width: pillW, height: pillH, color: pillBgCol });
                    }
                    
                    const textY = cy + pillH - pillPadY - textH;
                    pdfPage.drawText(ch, { x: cx + pillPadX, y: textY, size: fontSize, font, color });
                    
                    cx += pillW + gap;
                  }
                  continue;
                }
              } catch (e) {
                // Not JSON, fallback to standard text rendering
              }
            }
          }

          const padX = (layer.padding !== undefined ? layer.padding : 4) * SCALE_X;
          const padY = (layer.padding !== undefined ? layer.padding : 4) * SCALE_Y;
          const maxW = lw - padX * 2;
          
          const layerLineHeight = layer.lineHeight || 1.2;
          const layerLetterSpacing = layer.letterSpacing || 0;
          const isBold = !!(bold === true || bold === 'true' || bold === 'bold');
          const wrapResult = this.parseAndWrapHtml(text, font, regFont, boldFont, fontSize, maxW, layerLineHeight, layerLetterSpacing, isBold);
          const lines = wrapResult.lines;
          
          let actualTextWidth = wrapResult.totalWidth;
          const actualTextHeight = wrapResult.totalHeight;
          
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
          let textY = bgY + bgH - padY - baselineOffset; 
          
          for (const line of lines) {
            // For placeholder layers, clip to box. For regular text, allow overflow so all content shows.
            if (layer.isPlaceholder && textY < bgY) break;
            
            let drawX = bgX + padX + line.indentX;
            if (layer.align === 'center') drawX = bgX + (bgW - line.lineWidth) / 2;
            if (layer.align === 'right')  drawX = bgX + bgW - line.lineWidth - padX;
            
            if (line.isBullet && line.isFirstLineOfBullet) {
              const bulletRadius = Math.max(1.5, Math.min(3, fontSize * 0.18));
              pdfPage.drawEllipse({
                x: drawX + 4,
                y: textY + (fontSize * 0.28),
                xScale: bulletRadius,
                yScale: bulletRadius,
                color
              });
            }
            
            if (line.isBullet) {
              drawX += 16; // bulletIndent
            }

            for (const seg of line.segments) {
              const safeText = this.sanitizePdfText(seg.text);
              if (!safeText) continue;

              if (seg.bgColor && seg.bgColor !== 'transparent') {
                try {
                  const bg = this.hexToRgbPdf(seg.bgColor);
                  pdfPage.drawRectangle({ x: drawX, y: textY - (seg.fontSize * 0.25), width: seg.width, height: seg.height, color: bg });
                } catch (e) { console.warn('Invalid bgColor', seg.bgColor); }
              }
              const segColor = seg.color ? (() => {
                 try { return this.hexToRgbPdf(seg.color); } catch (e) { return color; }
              })() : color;
              
              try {
                if (layerLetterSpacing !== 0) {
                  let curX = drawX;
                  for (let j = 0; j < safeText.length; j++) {
                    const char = safeText[j];
                    pdfPage.drawText(char, { x: curX, y: textY, size: seg.fontSize, font: seg.font, color: segColor });
                    let charW = 0;
                    try { charW = seg.font.widthOfTextAtSize(char, seg.fontSize); } catch (e) { charW = seg.fontSize * 0.6; }
                    curX += charW + layerLetterSpacing;
                  }
                } else {
                  pdfPage.drawText(safeText, { x: drawX, y: textY, size: seg.fontSize, font: seg.font, color: segColor });
                }
              } catch (drawErr) {
                console.warn('Error drawing text segment:', drawErr);
              }
              drawX += seg.width;
            }
            // Move down by this line's dynamic height
            textY -= line.lineHeight || (fontSize * layerLineHeight);
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

  private hexToRgbPdf(colorStr: string): { type: string; red: number; green: number; blue: number } {
    if (!colorStr) return { type: 'RGB', red: 0, green: 0, blue: 0 };
    colorStr = colorStr.trim();
    if (colorStr.startsWith('rgb')) {
      const match = colorStr.match(/\d+/g);
      if (match && match.length >= 3) {
        return {
          type: 'RGB',
          red: parseInt(match[0]) / 255,
          green: parseInt(match[1]) / 255,
          blue: parseInt(match[2]) / 255
        };
      }
    }
    const namedColors: Record<string, string> = {
      red: '#FF0000', green: '#008000', blue: '#0000FF',
      yellow: '#FFFF00', black: '#000000', white: '#FFFFFF',
      transparent: '#000000'
    };
    if (namedColors[colorStr.toLowerCase()]) {
      colorStr = namedColors[colorStr.toLowerCase()];
    }
    const clean = colorStr.replace('#', '');
    let r = 0, g = 0, b = 0;
    if (clean.length === 3) {
      r = parseInt(clean.charAt(0) + clean.charAt(0), 16) / 255;
      g = parseInt(clean.charAt(1) + clean.charAt(1), 16) / 255;
      b = parseInt(clean.charAt(2) + clean.charAt(2), 16) / 255;
    } else if (clean.length >= 6) {
      r = parseInt(clean.substring(0, 2), 16) / 255;
      g = parseInt(clean.substring(2, 4), 16) / 255;
      b = parseInt(clean.substring(4, 6), 16) / 255;
    }
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

  private sanitizePdfText(str: string): string {
    if (!str) return '';
    return str
      .replace(/\u00A0/g, ' ')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-')
      .replace(/\r/g, '')
      .replace(/[^\x00-\x7F]/g, '');
  }

  private parseAndWrapHtml(html: string, defaultFont: any, regFont: any, boldFont: any, defaultFontSize: number, maxWidth: number, layerLineHeight: number = 1.2, layerLetterSpacing: number = 0, isLayerBold: boolean = false): { lines: any[], totalHeight: number, totalWidth: number } {
    if (!html) html = '';
    
    if (!html.includes('<')) {
       html = html.replace(/\n/g, '<br>');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    interface Token { text: string; font: any; fontSize: number; color?: string; bgColor?: string; isBullet: boolean; isFirstWordOfBullet: boolean; indentX: number; }
    
    const tokens: Token[] = [];
    let inBulletList = false;
    let bulletItemStart = false;

    const traverse = (node: Node, style: any) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) {
          const rawText = node.textContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          const parts = rawText.split('\n');
          for (let pi = 0; pi < parts.length; pi++) {
            if (pi > 0) {
              if (tokens.length > 0 && tokens[tokens.length - 1].text !== '\n') {
                tokens.push({ text: '\n', font: style.bold ? boldFont : regFont, fontSize: style.fontSize, isBullet: false, isFirstWordOfBullet: false, indentX: 0 });
              }
            }
            const part = parts[pi];
            if (part) {
              tokens.push({
                text: part,
                font: style.bold ? boldFont : regFont,
                fontSize: style.fontSize,
                color: style.color,
                bgColor: style.bgColor,
                isBullet: inBulletList,
                isFirstWordOfBullet: bulletItemStart,
                indentX: 0
              });
              bulletItemStart = false;
            }
          }
        }
        return;
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        
        let newStyle = { ...style };
        
        if (tag === 'b' || tag === 'strong') newStyle.bold = true;
        if (tag === 'ul') { inBulletList = true; }
        if (tag === 'li') { bulletItemStart = true; }
        
        if (tag === 'br' || tag === 'p' || tag === 'div' || tag === 'li') {
           if (tokens.length > 0 && tag !== 'br' && tokens[tokens.length - 1].text !== '\n') {
              tokens.push({ text: '\n', font: newStyle.bold ? boldFont : regFont, fontSize: defaultFontSize, isBullet: false, isFirstWordOfBullet: false, indentX: 0 });
           } else if (tag === 'br') {
              tokens.push({ text: '\n', font: newStyle.bold ? boldFont : regFont, fontSize: defaultFontSize, isBullet: false, isFirstWordOfBullet: false, indentX: 0 });
           }
        }

        if (el.style) {
           if (el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight) >= 700) newStyle.bold = true;
           if (el.style.color) newStyle.color = el.style.color;
           if (el.style.backgroundColor) newStyle.bgColor = el.style.backgroundColor;
           if (el.style.fontSize) {
              const px = parseFloat(el.style.fontSize);
              if (!isNaN(px)) newStyle.fontSize = px;
           }
        }
        
        if (tag === 'font') {
           const color = el.getAttribute('color');
           if (color) newStyle.color = color;
           const size = el.getAttribute('size');
           if (size) {
              const sizeMap: any = { '1': 10, '2': 12, '3': 16, '4': 20, '5': 24, '6': 32, '7': 48 };
              if (sizeMap[size]) newStyle.fontSize = sizeMap[size];
           }
        }
        
        for (let i = 0; i < el.childNodes.length; i++) {
          traverse(el.childNodes[i], newStyle);
        }
        
        if (tag === 'ul') { inBulletList = false; }
        if (tag === 'p' || tag === 'div' || tag === 'li') {
           if (tokens.length > 0 && tokens[tokens.length - 1].text !== '\n') {
              tokens.push({ text: '\n', font: newStyle.bold ? boldFont : regFont, fontSize: defaultFontSize, isBullet: false, isFirstWordOfBullet: false, indentX: 0 });
           }
        }
      }
    };
    
    traverse(doc.body, { bold: isLayerBold, fontSize: defaultFontSize, color: undefined, bgColor: undefined });
    
    const lines: any[] = [];
    let currentSegments: any[] = [];
    let currentLineWidth = 0;
    let maxLineWidth = 0;
    let maxLineHeight = 0;
    
    const bulletIndent = 16;
    let isBulletLine = false;
    let isFirstLineOfBullet = false;

    for (const token of tokens) {
       if (token.text === '\n') {
          lines.push({ segments: currentSegments, lineWidth: currentLineWidth, lineHeight: maxLineHeight, isBullet: isBulletLine, isFirstLineOfBullet: isFirstLineOfBullet, indentX: 0 });
          if (currentLineWidth + (isBulletLine ? bulletIndent : 0) > maxLineWidth) maxLineWidth = currentLineWidth + (isBulletLine ? bulletIndent : 0);
          currentSegments = [];
          currentLineWidth = 0;
          maxLineHeight = 0;
          isFirstLineOfBullet = false;
          isBulletLine = false;
          continue;
       }
       
       if (token.isBullet && currentSegments.length === 0) {
          isBulletLine = true;
          isFirstLineOfBullet = token.isFirstWordOfBullet;
       }
       
       const effectiveMaxWidth = isBulletLine ? maxWidth - bulletIndent : maxWidth;
       
       const words = token.text.split(' ');
       for (let i = 0; i < words.length; i++) {
         const word = words[i];
         const isLastWord = i === words.length - 1;
         const wordSpace = word + (isLastWord ? '' : ' ');
         if (!wordSpace) continue;
         
         const safeWordSpace = this.sanitizePdfText(wordSpace);
         let w = 0;
         try {
           w = token.font.widthOfTextAtSize(safeWordSpace, token.fontSize) + (safeWordSpace.length * layerLetterSpacing);
         } catch (e) {
           w = safeWordSpace.length * token.fontSize * 0.6;
         }
         if (isNaN(w) || w < 0) w = safeWordSpace.length * token.fontSize * 0.6;
         const h = token.fontSize * layerLineHeight;
         
         if (currentLineWidth + w > effectiveMaxWidth && currentLineWidth > 0) {
            lines.push({ segments: currentSegments, lineWidth: currentLineWidth, lineHeight: maxLineHeight, isBullet: isBulletLine, isFirstLineOfBullet: isFirstLineOfBullet, indentX: 0 });
            if (currentLineWidth + (isBulletLine ? bulletIndent : 0) > maxLineWidth) maxLineWidth = currentLineWidth + (isBulletLine ? bulletIndent : 0);
            
            isFirstLineOfBullet = false;
            currentSegments = [{ text: safeWordSpace, font: token.font, fontSize: token.fontSize, color: token.color, bgColor: token.bgColor, width: w, height: h }];
            currentLineWidth = w;
            maxLineHeight = h;
         } else {
            if (currentSegments.length > 0 && 
                currentSegments[currentSegments.length - 1].font === token.font && 
                currentSegments[currentSegments.length - 1].fontSize === token.fontSize && 
                currentSegments[currentSegments.length - 1].color === token.color && 
                currentSegments[currentSegments.length - 1].bgColor === token.bgColor) {
                
                currentSegments[currentSegments.length - 1].text += safeWordSpace;
                currentSegments[currentSegments.length - 1].width += w;
            } else {
                currentSegments.push({ text: safeWordSpace, font: token.font, fontSize: token.fontSize, color: token.color, bgColor: token.bgColor, width: w, height: h });
            }
            currentLineWidth += w;
            if (h > maxLineHeight) maxLineHeight = h;
         }
       }
    }
    
    if (currentSegments.length > 0) {
       lines.push({ segments: currentSegments, lineWidth: currentLineWidth, lineHeight: maxLineHeight, isBullet: isBulletLine, isFirstLineOfBullet: isFirstLineOfBullet, indentX: 0 });
       if (currentLineWidth + (isBulletLine ? bulletIndent : 0) > maxLineWidth) maxLineWidth = currentLineWidth + (isBulletLine ? bulletIndent : 0);
    }
    
    let totalHeight = 0;
    for (const line of lines) { totalHeight += line.lineHeight || (defaultFontSize * layerLineHeight); }
    
    return { lines, totalHeight, totalWidth: maxLineWidth };
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
}
