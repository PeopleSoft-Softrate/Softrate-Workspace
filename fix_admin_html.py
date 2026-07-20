with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/admin-workspace/sections/admin-workspace-modals/admin-workspace-modals.component.html', 'r') as f:
    html = f.read()

# 1. Remove gst-selection-overlay
start_gst = html.find('<div class="invoice-overlay gst-selection-overlay"')
if start_gst != -1:
    end_gst = html.find('</div>\n<!-- ══ HISTORY MODAL ══ -->', start_gst)
    if end_gst != -1:
        # Include the closing </div>
        html = html[:start_gst] + html[end_gst+7:]

# 2. Extract the form grid and table and note editor
start_form = html.find('<div class="invoice-form-grid')
end_note = html.find('<div id="invoice-preview"')

controls_block = html[start_form:end_note]

# 3. Add GST selector to controls block
gst_selector = """
      <!-- Inline GST Rate Selector -->
      <div class="quotation-gst-selector invoice-control-card">
        <div class="quotation-gst-selector-label">
          <i class="fa-solid fa-percent"></i>
          <span>GST Rate</span>
        </div>
        <div class="quotation-gst-selector-options">
          <button
            class="quotation-gst-opt"
            [class.quotation-gst-opt--active]="vm.documentGstPercentageOverride === null"
            type="button"
            (click)="vm.documentGstPercentageOverride = null; vm.refreshInvoiceItemGstFromSelection()"
          >
            <span class="quotation-gst-opt-pct">{{ vm.settingsGstPercentage || 18 }}%</span>
            <span class="quotation-gst-opt-label">GST</span>
          </button>
          <button
            class="quotation-gst-opt"
            [class.quotation-gst-opt--active]="vm.documentGstPercentageOverride === 0"
            type="button"
            (click)="vm.documentGstPercentageOverride = 0; vm.refreshInvoiceItemGstFromSelection()"
          >
            <span class="quotation-gst-opt-pct">0%</span>
            <span class="quotation-gst-opt-label">GST</span>
          </button>
          <button
            class="quotation-gst-opt quotation-gst-opt--exempt"
            [class.quotation-gst-opt--active]="vm.documentGstPercentageOverride === -1"
            type="button"
            (click)="vm.documentGstPercentageOverride = -1; vm.refreshInvoiceItemGstFromSelection()"
          >
            <span class="quotation-gst-opt-pct">Excl.</span>
            <span class="quotation-gst-opt-label">GST Exempt</span>
          </button>
        </div>
      </div>
"""

# Find where the note editor starts in controls_block and insert gst_selector before it
note_idx = controls_block.find('<label class="quotation-note-editor')
controls_with_gst = controls_block[:note_idx] + gst_selector + controls_block[note_idx:]

# 4. Extract the quotation preview section
# From <ng-container *ngIf="vm.quoteMode; else adminInvoicePrintHeader">
# To <ng-template #adminInvoicePrintHeader>
start_preview = html.find('<ng-container *ngIf="vm.quoteMode; else adminInvoicePrintHeader">')
end_preview = html.find('<ng-template #adminInvoicePrintHeader>')
quotation_preview_block = html[start_preview:end_preview]

# 5. Build the new layout
new_layout = f"""
      <ng-container *ngIf="vm.quoteMode && !vm.viewingSavedDocument; else adminInvoiceStackLayout">
        <div class="quotation-builder-layout">
          <!-- LEFT: Controls -->
          <div class="quotation-builder-controls">
{controls_with_gst}
          </div>
          <!-- RIGHT: Live Preview -->
          <div class="quotation-builder-preview">
            <div id="invoice-preview" class="invoice-preview quotation-preview">
{quotation_preview_block}
            </div>
          </div>
        </div>
      </ng-container>

      <ng-template #adminInvoiceStackLayout>
{controls_block}
        <div id="invoice-preview" class="invoice-preview" [class.quotation-preview]="vm.quoteMode">
{quotation_preview_block}
"""

# Replace the original block in HTML
end_preview_tag = html.find('</ng-template>', end_preview) + len('</ng-template>')
# Also need to find the closing </div> of the invoice-preview
closing_preview_div = html.find('</div>', end_preview_tag) + len('</div>')

# The original block goes from start_form to closing_preview_div
html = html[:start_form] + new_layout + html[end_preview:]

with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/admin-workspace/sections/admin-workspace-modals/admin-workspace-modals.component.html', 'w') as f:
    f.write(html)
