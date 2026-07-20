with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/invoices/presentation/admin-invoice-quotation.workflow.ts', 'r') as f:
    ts_code = f.read()

start_str = "    if (!vm.gstSelectionConfirmed) {"
end_str = "      return;\n    }"
start_idx = ts_code.find(start_str)
end_idx = ts_code.find(end_str, start_idx) + len(end_str)

if start_idx != -1 and end_idx != -1:
    ts_code = ts_code[:start_idx] + ts_code[end_idx:]
    with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/invoices/presentation/admin-invoice-quotation.workflow.ts', 'w') as f:
        f.write(ts_code)
    print("Workflow updated!")
else:
    print("Could not find block")
