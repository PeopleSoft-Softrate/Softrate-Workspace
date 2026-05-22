# NDA Template Builder Reference

This document describes the document/certificate template builder from the HRMS application and adapts it for a company-side NDA generation feature where HR can edit placeholders, paragraph content, page backgrounds, and PDF layout before generating client-facing NDA files.

## Source References

Frontend builder (`apps/hrms/emp-hr`):
- `apps/hrms/emp-hr/src/app/features/certificate-settings/certificate-settings.ts`
- `apps/hrms/emp-hr/src/app/features/certificate-settings/certificate-settings.html`
- `apps/hrms/emp-hr/src/app/features/certificate-settings/certificate-settings.css`
- `apps/hrms/emp-hr/src/app/services/api.service.ts`

Backend (`services/hrms`):
- `services/hrms/routes/settings.routes.js`
- `services/hrms/models/CompanyModel.js`
- `services/hrms/utilities/certificateGenerator.js`
- `services/hrms/routes/internRoutes.js`
- `services/hrms/controllers/resignation.controller.js`

## Goal For The NDA Project

Build an HR-editable NDA template system with:
- Multi-page NDA templates.
- Per-page background upload.
- Portrait or landscape page orientation.
- Dynamic placeholder chips placed by X/Y coordinates.
- Rich paragraph blocks with editable text and inline placeholders.
- Visual drag-and-drop mapping against an A4 preview.
- Save/load template settings per company.
- PDF generation that overlays resolved data onto the saved template.

## Current Builder Feature Inventory

### Document Types

The current app supports these template groups:

Onboarding documents:
- Offer Letter: `offerLetter`
- Annexure: `annexure`
- NDA: `nda`

Offboarding documents:
- Letter of Recommendation: `lor`
- Internship Completion: `internshipCompletion`
- Project Completion: `projectCompletion`

For your other project, you can simplify this to only:

```ts
documentTemplates = {
  nda: defaultTemplate('portrait')
};
```

Or keep multiple NDA variants:

```ts
documentTemplates = {
  clientNda: defaultTemplate('portrait'),
  vendorNda: defaultTemplate('portrait'),
  employeeNda: defaultTemplate('portrait')
};
```

### Page Management

Each template contains one or more pages.

Supported behavior:
- Add page.
- Remove page, except the last remaining page.
- Switch page using tabs.
- Each page maps to one generated PDF page.
- Each page owns its own background, placeholder chips, and paragraph blocks.

Current default page:

```ts
{
  backgroundUrl: '',
  placeholders: [],
  paragraphs: []
}
```

Current default template:

```ts
{
  orientation: 'portrait',
  pages: [defaultPage()]
}
```

### Orientation

Supported orientations:
- `portrait`
- `landscape`

Preview canvas dimensions:

```ts
portrait:  595 x 842
landscape: 842 x 595
```

Backend PDFKit dimensions:

```js
portrait:  width 595.28, height 841.89
landscape: width 841.89, height 595.28
```

These dimensions are A4 points. Keep the same coordinate system in the editor and generator so X/Y values match the final PDF.

### Background Upload

The current UI allows an HR user to upload a background image per page.

Behavior:
- File input accepts `image/*`.
- File is read with `FileReader`.
- Stored as a base64 data URL in `page.backgroundUrl`.
- Current file size limit is 5 MB.
- Preview renders it as `background-image`.
- PDF generator loads the image and stretches it to full page width/height.

Recommended NDA usage:
- Use a full-page image background for branded NDA letterhead.
- Use PDF-safe image formats: PNG or JPG.
- Keep base64 images small if storing in MongoDB; for production, prefer object storage and save only the URL.

### Placeholder Chips

Placeholder chips are small draggable fields that resolve directly to data values during PDF generation.

Current fields:

```ts
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
```

For a client-side NDA generator, use NDA-specific fields:

```ts
availablePlaceholderKeys = [
  { key: 'companyName',       label: 'Company Name' },
  { key: 'companyAddress',    label: 'Company Address' },
  { key: 'companyEmail',      label: 'Company Email' },
  { key: 'clientName',        label: 'Client Name' },
  { key: 'clientCompanyName', label: 'Client Company Name' },
  { key: 'clientAddress',     label: 'Client Address' },
  { key: 'clientEmail',       label: 'Client Email' },
  { key: 'effectiveDate',     label: 'Effective Date' },
  { key: 'expiryDate',        label: 'Expiry Date' },
  { key: 'projectName',       label: 'Project Name' },
  { key: 'jurisdiction',      label: 'Jurisdiction' },
  { key: 'signatoryName',     label: 'Authorized Signatory' },
  { key: 'signatoryTitle',    label: 'Signatory Title' },
  { key: 'todayDate',         label: 'Current Date' }
];
```

Placeholder chip schema:

```ts
{
  key: 'clientName',
  x: 100,
  y: 100,
  fontSize: 18,
  isBold: false,
  color: '#000000'
}
```

Current chip controls:
- Data field dropdown.
- X coordinate input.
- Y coordinate input.
- Font size input.
- Bold checkbox.
- Text color picker.
- Remove button.
- Drag on visual canvas.

Current drag constraints:
- X cannot be below `0`.
- Y cannot be below `0`.
- Placeholder max X is `canvasWidth - 80`.
- Placeholder max Y is `canvasHeight - 30`.

### Content Paragraphs

Paragraph blocks are rich text blocks that HR can write and position on the canvas.

Default paragraph:

```ts
{
  id: Date.now().toString(),
  text: '',
  x: 50,
  y: 120,
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
}
```

Paragraph controls:
- Add paragraph.
- Remove paragraph.
- Collapse/expand editor block.
- X/Y position shown in header.
- Font size stepper and number input.
- Text alignment: left, center, right, justify.
- Bold toggle.
- Italic toggle.
- Text color picker.
- Font family dropdown.
- Width input in pixels.
- Letter spacing slider.
- Line height slider.
- Insert placeholder dropdown.
- Multi-line textarea.
- Drag block on visual canvas.

Font size:
- Minimum: `6`
- Maximum: `120`
- Stepper changes by `1`

Width:
- Minimum: `80`
- Maximum: `820`

Letter spacing:
- Minimum: `0em`
- Maximum: `0.5em`
- Step: `0.01`

Line height:
- Minimum: `1`
- Maximum: `3`
- Step: `0.1`

Alignment values:

```ts
'left' | 'center' | 'right' | 'justify'
```

Supported font options:

```ts
[
  { name: 'System Default', value: 'inherit' },
  { name: 'Inter', value: "'Inter', sans-serif" },
  { name: 'Outfit', value: "'Outfit', sans-serif" },
  { name: 'Playfair Display', value: "'Playfair Display', serif" },
  { name: 'Great Vibes (Script)', value: "'Great Vibes', cursive" },
  { name: 'Montserrat', value: "'Montserrat', sans-serif" },
  { name: 'Georgia', value: "Georgia, serif" },
  { name: 'Courier New', value: "'Courier New', monospace" }
]
```

### Inline Placeholder Insertion

Paragraph text supports inline dynamic placeholders:

```text
This NDA is entered into by {{companyName}} and {{clientCompanyName}} on {{effectiveDate}}.
```

The current UI inserts placeholders at the textarea cursor position:

```ts
const token = '{{' + key + '}}';
```

During PDF generation, placeholders are resolved using:

```js
text.replace(/\{\{([^}]+)\}\}/g, (match, key) => data[key.trim()] || '')
```

Date fields are formatted when the key contains `date`.

### Visual Mapping Canvas

The visual builder shows:
- Page background.
- Draggable placeholder chips.
- Draggable paragraph blocks.
- Live typography preview for paragraphs.
- A handle badge for paragraph blocks, such as `P1`.

Canvas styles:
- A4 dimensions in points/pixels.
- Background size: `100% 100%`.
- Background repeat: `no-repeat`.
- Background position: `top left`.

Important implementation rule:
- The canvas coordinate system must match the PDF coordinate system.
- Do not use percentage coordinates unless you also convert them carefully during PDF generation.

## Recommended NDA Data Model

Use this as the core persisted schema for your other project.

```ts
type NdaTemplate = {
  orientation: 'portrait' | 'landscape';
  pages: NdaTemplatePage[];
};

type NdaTemplatePage = {
  backgroundUrl: string;
  placeholders: PlaceholderChip[];
  paragraphs: ParagraphBlock[];
};

type PlaceholderChip = {
  key: string;
  x: number;
  y: number;
  fontSize: number;
  isBold: boolean;
  color: string;
};

type ParagraphBlock = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  alignment: 'left' | 'center' | 'right' | 'justify';
  letterSpacing: number;
  lineHeight: number;
  isBold: boolean;
  isItalic: boolean;
  color: string;
  isCollapsed?: boolean;
};
```

Example persisted NDA template:

```json
{
  "ndaTemplate": {
    "orientation": "portrait",
    "pages": [
      {
        "backgroundUrl": "https://cdn.example.com/templates/nda-page-1.png",
        "placeholders": [
          {
            "key": "effectiveDate",
            "x": 420,
            "y": 110,
            "fontSize": 12,
            "isBold": false,
            "color": "#111827"
          }
        ],
        "paragraphs": [
          {
            "id": "nda-intro",
            "text": "This Non-Disclosure Agreement is entered into by {{companyName}} and {{clientCompanyName}} for the project {{projectName}}.",
            "x": 72,
            "y": 180,
            "width": 450,
            "fontSize": 12,
            "fontFamily": "Georgia, serif",
            "alignment": "justify",
            "letterSpacing": 0,
            "lineHeight": 1.5,
            "isBold": false,
            "isItalic": false,
            "color": "#111827"
          }
        ]
      }
    ]
  }
}
```

## Recommended API Contract

### Get NDA Template

```http
GET /api/settings/nda-template
Authorization: Bearer <token>
```

Response:

```json
{
  "success": true,
  "ndaTemplate": {
    "orientation": "portrait",
    "pages": []
  }
}
```

### Save NDA Template

```http
PUT /api/settings/nda-template
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "ndaTemplate": {
    "orientation": "portrait",
    "pages": []
  }
}
```

Response:

```json
{
  "success": true,
  "message": "NDA template saved successfully",
  "ndaTemplate": {}
}
```

### Generate NDA PDF

```http
POST /api/nda/generate
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "clientId": "client_123",
  "projectId": "project_456",
  "templateId": "default"
}
```

Backend should:
1. Load company details.
2. Load client details.
3. Load project details.
4. Load saved NDA template.
5. Build a flat `docData` object.
6. Call `generateDynamicPDF(docData, ndaTemplate)`.
7. Return or store the generated PDF.

## NDA `docData` Shape

Use a flat object so placeholder resolution is simple.

```js
const docData = {
  companyName: company.name,
  companyAddress: company.address,
  companyEmail: company.email,
  companyPhone: company.phone,
  clientName: client.contactName,
  clientCompanyName: client.companyName,
  clientAddress: client.address,
  clientEmail: client.email,
  effectiveDate: nda.effectiveDate,
  expiryDate: nda.expiryDate,
  projectName: project.name,
  projectDescription: project.description,
  jurisdiction: nda.jurisdiction || company.defaultJurisdiction,
  signatoryName: company.signatoryName,
  signatoryTitle: company.signatoryTitle,
  todayDate: new Date()
};
```

## PDF Generation Behavior

Current backend generator uses PDFKit.

Generation flow:
1. Create a PDF document with A4 size, selected layout, zero margin, and no automatic first page.
2. For each page:
   - Add one PDF page.
   - Draw page background image at full page size.
   - Draw placeholder chips.
   - Draw rich paragraph blocks.
3. Resolve inline paragraph placeholders.
4. Format date-like fields.
5. End the PDF and return a buffer.

Key behavior from `certificateGenerator.js`:

```js
async function generateDynamicPDF(data, template = {}) {
  const orientation = template.orientation || 'portrait';
  const width = orientation === 'portrait' ? 595.28 : 841.89;
  const height = orientation === 'portrait' ? 841.89 : 595.28;

  for (const page of pages) {
    doc.addPage({ size: 'A4', layout: orientation, margin: 0 });

    if (page.backgroundUrl) {
      const bgBuffer = await getAssetBuffer(page.backgroundUrl);
      if (bgBuffer) doc.image(bgBuffer, 0, 0, { width, height });
    }

    for (const p of page.placeholders || []) {
      const text = data[p.key] || '';
      doc.fontSize(p.fontSize || 12)
        .fillColor(p.color || '#000000')
        .text(text, p.x, p.y);
    }

    for (const para of page.paragraphs || []) {
      const text = resolveParagraphText(para.text, data);
      doc.text(text, para.x, para.y, {
        width: para.width || 400,
        align: para.alignment || 'left'
      });
    }
  }
}
```

Production improvements for NDA generation:
- Validate placeholder keys against an allowlist.
- Sanitize user-entered paragraph text.
- Support missing-value fallback text such as `{{clientName|Client}}`.
- Store generated PDFs in object storage.
- Keep an audit log of who edited the NDA template and who generated each NDA.
- Version templates so old NDAs can be regenerated exactly.

## Font Mapping

Frontend font values are CSS font-family strings, but PDFKit needs actual font files or built-in PDF font names.

Current backend mappings:
- `inherit` -> Times New Roman asset or `Times-Roman`.
- `Great Vibes` -> `services/hrms/assets/fonts/GreatVibes-Regular.ttf`.
- `Inter` -> `services/hrms/assets/fonts/Inter-Regular.ttf` or `services/hrms/assets/fonts/Inter-Bold.ttf`.
- `Outfit` -> `services/hrms/assets/fonts/Outfit-Regular.ttf` or `services/hrms/assets/fonts/Outfit-Bold.ttf`.
- `Montserrat` -> `services/hrms/assets/fonts/Montserrat-Regular.ttf` or `services/hrms/assets/fonts/Montserrat-Bold.ttf`.
- `Playfair Display` -> `services/hrms/assets/fonts/PlayfairDisplay-Regular.ttf` or `services/hrms/assets/fonts/PlayfairDisplay-Bold.ttf`.
- `Georgia` -> PDFKit Times fonts.
- `Courier New` -> PDFKit Courier fonts.

In the current repo layout, include backend font files in:

```text
services/hrms/assets/fonts/
```

Recommended minimum:
- `TimesNewRoman.ttf`
- `TimesNewRomanBold.ttf`
- `Inter-Regular.ttf`
- `Inter-Bold.ttf`

## Storage Design

Current HRMS storage path:

```js
company.settings.offerLetterSettings.documentTemplates.nda
```

For your NDA project, use a clearer domain-specific path:

```js
company.settings.ndaTemplate
```

Or, if supporting multiple templates:

```js
company.settings.documentTemplates.nda
company.settings.documentTemplates.clientNda
company.settings.documentTemplates.vendorNda
```

Mongo-style schema example:

```js
ndaTemplate: {
  orientation: { type: String, default: 'portrait' },
  pages: [{
    backgroundUrl: String,
    placeholders: [{
      key: String,
      x: Number,
      y: Number,
      fontSize: Number,
      isBold: Boolean,
      color: String
    }],
    paragraphs: [mongoose.Schema.Types.Mixed]
  }]
}
```

Use `Mixed` for paragraphs if you want flexibility. Use a strict nested schema if you need stronger validation.

## HR Editor UX Requirements

Recommended screen layout:
- Left sidebar: document/template list.
- Main panel header: selected template name and description.
- Page tabs row: page switching and add page.
- Orientation/background section.
- Placeholder chips table.
- Content paragraphs editor.
- Visual mapping canvas.
- Save footer.

Required controls:
- `Add Page`
- `Remove Page`
- `Portrait`
- `Landscape`
- `Upload/Change Background`
- `Add Chip`
- `Remove Chip`
- `Add Paragraph`
- `Remove Paragraph`
- `Collapse Paragraph`
- `Insert Placeholder`
- `Save Template`
- Optional: `Preview PDF`
- Optional: `Generate Test NDA`

Recommended NDA-specific additions:
- Template version name, such as `NDA v1.0`.
- Clause library, such as confidentiality, non-compete, data protection, jurisdiction.
- Preview with sample client data.
- Duplicate template.
- Reset to default template.
- Export/import template JSON.

## NDA Paragraph Examples

Opening clause:

```text
This Non-Disclosure Agreement is entered into as of {{effectiveDate}} by and between {{companyName}}, located at {{companyAddress}}, and {{clientCompanyName}}, represented by {{clientName}}.
```

Confidential information clause:

```text
The receiving party agrees to protect all confidential information disclosed in connection with {{projectName}}, including business, technical, financial, operational, client, vendor, source code, product, design, and strategic information.
```

Purpose clause:

```text
The confidential information shall be used only for evaluating, discussing, or performing work related to {{projectName}} and shall not be used for any unauthorized purpose.
```

Term clause:

```text
This Agreement begins on {{effectiveDate}} and remains in effect until {{expiryDate}}, unless extended in writing by both parties.
```

Jurisdiction clause:

```text
This Agreement shall be governed by the laws of {{jurisdiction}}.
```

Signature block:

```text
For {{companyName}}

Authorized Signatory: {{signatoryName}}
Title: {{signatoryTitle}}
Date: {{todayDate}}
```

## Frontend Implementation Checklist

1. Create `NdaTemplateBuilderComponent`.
2. Define `availablePlaceholderKeys` for company/client/project/NDA fields.
3. Define `defaultPage()` and `defaultTemplate()`.
4. Load saved template from `GET /api/settings/nda-template`.
5. Add page tab management.
6. Add orientation toggle.
7. Add background upload.
8. Add placeholder chip table.
9. Add paragraph editor blocks.
10. Add textarea cursor insertion for `{{fieldName}}`.
11. Add visual canvas with draggable chips and paragraphs.
12. Clamp drag positions within A4 canvas bounds.
13. Save via `PUT /api/settings/nda-template`.
14. Add `Preview PDF` by calling `POST /api/nda/preview`.
15. Add loading, saving, and error states.

## Backend Implementation Checklist

1. Add `ndaTemplate` to company settings or create a separate `NdaTemplate` collection.
2. Add authenticated `GET /api/settings/nda-template`.
3. Add authenticated `PUT /api/settings/nda-template`.
4. Add `POST /api/nda/generate`.
5. Build `docData` from company, client, project, and NDA records.
6. Reuse or port `generateDynamicPDF`.
7. Add font assets and font mapping.
8. Add image fetching for background URLs.
9. Validate template payload size and allowed keys.
10. Generate PDF buffer.
11. Store PDF or stream it back.
12. Log template version and generation metadata.

## Important Edge Cases

Handle these before production:
- Empty template pages.
- Missing background image.
- Missing placeholder value.
- Invalid color string.
- Invalid font family.
- Paragraph width too small.
- Paragraph positioned outside canvas.
- Large base64 image payloads.
- Multi-page PDF generation.
- Date formatting for all date fields.
- Long client/company names wrapping unexpectedly.
- HR saving while another HR has already updated the template.

## Suggested Enhancements

For a professional NDA workflow, add:
- `Preview with sample data`.
- `Preview with selected client`.
- `Download template JSON`.
- `Upload template JSON`.
- `Version history`.
- `Restore previous version`.
- `Required placeholders` validation.
- `Clause library`.
- `Signature image block`.
- `Company seal image block`.
- `Page duplicate`.
- `Grid snapping`.
- `Keyboard nudging` with arrow keys.
- `Zoom controls`.
- `PDF preview iframe`.

## Minimal Reuse Plan

If you want to move this fast into another app:
1. Copy the data model from this file.
2. Copy the page/orientation/background/placeholder/paragraph builder behavior.
3. Copy `generateDynamicPDF` from the backend.
4. Replace HRMS fields with NDA fields.
5. Store only `company.settings.ndaTemplate`.
6. Add one generate endpoint that creates the NDA from company + client + project data.
