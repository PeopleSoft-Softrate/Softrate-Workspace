with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/emp/src/app/features/workspace/employee-workspace.component.css', 'r') as f:
    emp_css = f.read()

# We need the CSS blocks for .quotation-builder-layout, .quotation-builder-controls, .quotation-builder-preview, .quotation-gst-selector
# They start around "/* ── Inline GST Rate Selector (Quotation Builder) ── */" and "/* ── Quotation Builder Side-by-Side Layout ── */"

start_idx_1 = emp_css.find('/* ── Inline GST Rate Selector (Quotation Builder) ── */')
if start_idx_1 != -1:
    css_to_add = emp_css[start_idx_1:]
    
    with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/admin-workspace/styles/employee-portal-parity.css', 'a') as f:
        f.write('\n\n')
        f.write(css_to_add)
    print("CSS Ported!")
else:
    print("Could not find CSS block")
