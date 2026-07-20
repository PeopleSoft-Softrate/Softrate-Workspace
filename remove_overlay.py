with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/admin-workspace/sections/admin-workspace-modals/admin-workspace-modals.component.html', 'r') as f:
    admin_html = f.read()

start_str = '<div class="invoice-overlay gst-selection-overlay"'
start_idx = admin_html.find(start_str)

if start_idx != -1:
    # Find the closing </div> of this overlay.
    # It ends right before <datalist id="remarkSuggestions">
    end_str = '<datalist id="remarkSuggestions">'
    end_idx = admin_html.find(end_str)
    
    new_admin_html = admin_html[:start_idx] + admin_html[end_idx:]
    with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/admin-workspace/sections/admin-workspace-modals/admin-workspace-modals.component.html', 'w') as f:
        f.write(new_admin_html)
    print("Overlay removed!")
else:
    print("Overlay not found")
