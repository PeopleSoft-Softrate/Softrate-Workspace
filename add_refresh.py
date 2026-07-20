with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/invoices/presentation/admin-invoice-quotation.workflow.ts', 'r') as f:
    wf_code = f.read()

# Add refreshInvoiceItemGstFromSelection to workflow
refresh_method = """
  refreshInvoiceItemGstFromSelection(vm: any): void {
    if (vm.viewingSavedDocument) return;
    vm.invoiceItems.forEach((item: any) => {
      if (item?.taxable === undefined && item?.gst === undefined && item?.total === undefined) return;
      const quantity = Math.max(1, Number(item.quantity || 1));
      const taxable = Number(item.price || 0) * quantity;
      const gst = taxable * (this.invoicePreviewGstPercentage(vm) / 100);
      item.taxable = taxable;
      item.gst = gst;
      item.total = taxable + gst;
    });
    this.refreshInvoicePreviewCaches(vm);
  }
"""
# Insert before printInvoice
idx = wf_code.find("  printInvoice(vm: any): void {")
if idx != -1:
    wf_code = wf_code[:idx] + refresh_method + wf_code[idx:]
    with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/invoices/presentation/admin-invoice-quotation.workflow.ts', 'w') as f:
        f.write(wf_code)
    print("Workflow method added!")
else:
    print("Could not find printInvoice in workflow")

with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/admin-workspace/state/admin-workspace.controller.ts', 'r') as f:
    ctrl_code = f.read()

# Add delegate to controller
delegate_method = """  refreshInvoiceItemGstFromSelection(): void { return this.invoiceQuotationWorkflow.refreshInvoiceItemGstFromSelection(this); }\n"""
idx2 = ctrl_code.find("  saveAndPrintQuotation(): void { return this.invoiceQuotationWorkflow.saveAndPrintQuotation(this); }")
if idx2 != -1:
    ctrl_code = ctrl_code[:idx2] + delegate_method + ctrl_code[idx2:]
    with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/admin-workspace/state/admin-workspace.controller.ts', 'w') as f:
        f.write(ctrl_code)
    print("Controller method added!")
else:
    print("Could not find saveAndPrintQuotation in controller")

