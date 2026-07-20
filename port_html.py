import re

with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/emp/src/app/features/workspace/employee-workspace.component.html', 'r') as f:
    emp_html = f.read()

with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/admin-workspace/sections/admin-workspace-modals/admin-workspace-modals.component.html', 'r') as f:
    admin_html = f.read()

# Extract from employee html
start_str = "<!-- Quotation: side-by-side layout (controls left, preview right) -->"
end_str = "        <ng-template #invoicePreviewDocument>"

start_idx = emp_html.find(start_str)
end_idx = emp_html.find(end_str)

emp_block = emp_html[start_idx:end_idx]

# Replace specific variables with vm.
replacements = [
    (r'quoteMode', r'vm.quoteMode'),
    (r'viewingSavedDocument', r'vm.viewingSavedDocument'),
    (r'selectedInvoiceProduct', r'vm.selectedInvoiceProduct'),
    (r'onProductSelect\(\)', r'vm.onProductSelect()'),
    (r'visibleProducts', r'vm.settingsProducts'), # In admin it's settingsProducts
    (r'invoicePrice', r'vm.invoicePrice'),
    (r'invoiceQuantity', r'vm.invoiceQuantity'),
    (r'addInvoiceItem\(\)', r'vm.addInvoiceItem()'),
    (r'invoiceItems', r'vm.invoiceItems'),
    (r'formatInvoiceMoney\(', r'vm.formatInvoiceMoney('),
    (r'removeInvoiceItem\(', r'vm.removeInvoiceItem('),
    (r'documentGstPercentageOverride', r'vm.documentGstPercentageOverride'),
    (r'refreshInvoiceItemGstFromSelection\(\)', r'vm.refreshInvoiceItemGstFromSelection()'),
    (r'gstPercentage', r'vm.settingsGstPercentage'), # In admin controller it is settingsGstPercentage
    (r'quotationKindNoteDraft', r'vm.quotationKindNoteDraft'),
    (r'quotationCompanyLogo\(\)', r'vm.invoiceLogoSrc()'), # In admin it's invoiceLogoSrc()
    (r'invoiceCompanyDisplayName\(\)', r'vm.invoiceCompanyDisplayName()'),
    (r'invoiceNumber\(\)', r'vm.invoiceNumber()'),
    (r'invoiceIssuedAt', r'vm.invoiceIssuedAt'),
    (r'quotationPrintBody', r'adminQuotationPrintBody'),
    (r'invoiceCompanyAddress\(\)', r'vm.invoiceCompanyAddress()'),
    (r'quotationBankRows', r'vm.quotationBankRows()'),
    (r'quotationNoBankDetails', r'adminQuotationNoBankDetails'),
    (r'quotationTerms', r'vm.quotationTerms'),
    (r'invoiceContactLine\(\)', r'vm.invoiceContactLine()'),
    (r'currentYear', r'vm.currentYear'),
]

admin_block = emp_block
for pattern, repl in replacements:
    admin_block = re.sub(pattern, repl, admin_block)

# In admin_html, find the region to replace
# From <div class="invoice-form-grid invoice-control-card" [class.invoice-form-grid-quotation]="vm.quoteMode"
# Down to <ng-template #adminInvoicePrintHeader>

admin_start_str = """      <div class="invoice-form-grid invoice-control-card" [class.invoice-form-grid-quotation]="vm.quoteMode"
        *ngIf="!vm.viewingSavedDocument">"""
admin_end_str = "        <ng-template #adminInvoicePrintHeader>"

a_start_idx = admin_html.find(admin_start_str)
a_end_idx = admin_html.find(admin_end_str)

if a_start_idx == -1 or a_end_idx == -1:
    print("Could not find boundaries in admin HTML")
    exit(1)

new_admin_html = admin_html[:a_start_idx] + admin_block + admin_html[a_end_idx:]

with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/admin-workspace/sections/admin-workspace-modals/admin-workspace-modals.component.html', 'w') as f:
    f.write(new_admin_html)

print("HTML replacement complete!")
