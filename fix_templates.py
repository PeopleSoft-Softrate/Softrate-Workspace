with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/admin-workspace/sections/admin-workspace-modals/admin-workspace-modals.component.html', 'r') as f:
    html = f.read()

# We need to extract <ng-template #adminInvoicePrintHeader> and <ng-template #adminQuotationPrintBody>
# and place them right before <div class="action-row invoice-builder-actions">

header_start = html.find('<ng-template #adminInvoicePrintHeader>')
if header_start != -1:
    header_end = html.find('</ng-template>', header_start) + len('</ng-template>')
    
    # Wait, in the original HTML, adminQuotationPrintBody was separate from adminInvoicePrintHeader?
    # Let's find adminQuotationPrintBody
    body_start = html.find('<ng-template #adminQuotationPrintBody>')
    if body_start != -1:
        body_end = html.find('</ng-template>', body_start) + len('</ng-template>')
        
        # Check their order. Does one contain the other? No.
        if body_start > header_end or header_start > body_end:
            # They are disjoint
            if header_start < body_start:
                first_start = header_start
                first_end = header_end
                second_start = body_start
                second_end = body_end
            else:
                first_start = body_start
                first_end = body_end
                second_start = header_start
                second_end = header_end
            
            second_block = html[second_start:second_end]
            first_block = html[first_start:first_end]
            
            # Remove both from their current positions
            html = html[:second_start] + html[second_end:]
            html = html[:first_start] + html[first_end:]
            
            # Re-insert before action row
            action_row_idx = html.find('<div class="action-row invoice-builder-actions">')
            html = html[:action_row_idx] + first_block + '\n' + second_block + '\n' + html[action_row_idx:]
            
            with open('/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/admin-workspace/sections/admin-workspace-modals/admin-workspace-modals.component.html', 'w') as f:
                f.write(html)
            print("Fixed templates!")
        else:
            print("Templates overlap!")
    else:
        print("body not found")
else:
    print("header not found")
