import re

leads_path = '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/leads/presentation/admin-leads-section/admin-leads-section.component.html'
followups_path = '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/follow-ups/presentation/admin-followups-section/admin-followups-section.component.html'

with open(leads_path, 'r') as f:
    leads_html = f.read()
with open(followups_path, 'r') as f:
    followups_html = f.read()

# 1. Add view toggle to followups
toggle_html = """            <div class="view-mode-toggle lead-workspace-view-toggle">
              <button class="view-mode-btn" [class.active]="adminFollowupViewMode === 'table'"
                (click)="adminFollowupViewMode = 'table'" title="Table View" aria-label="Table View">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M4 4h16v6H4V4zm0 10h16v6H4v-6z" />
                </svg>
              </button>
              <button class="view-mode-btn" [class.active]="adminFollowupViewMode === 'grid'"
                (click)="adminFollowupViewMode = 'grid'" title="Card View" aria-label="Card View">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
                </svg>
              </button>
            </div>
"""

followups_html = followups_html.replace(
    '            </div>\n          </div>\n\n          <div class="record-frame',
    '            </div>\n' + toggle_html + '          </div>\n\n          <div class="record-frame',
    1
)

# 2. Extract table html from leads
start_tag = '<div class="lead-table-wrapper"'
end_tag = '                <!-- Lead Cards Grid -->'
start_idx = leads_html.find(start_tag)
end_idx = leads_html.find(end_tag, start_idx)
table_html = leads_html[start_idx:end_idx]

# Remove the trailing '                </div>\n\n' from table_html
table_html = table_html.rstrip()
if table_html.endswith('</div>'):
    # remove the closing div of the table container? wait.
    pass # Actually the end_tag includes it, we just need to make sure we don't grab extra stuff. Let's rely on standard search

# Wait, `lead-table-wrapper` has a closing `</div>`. 
table_html = table_html.strip()
if table_html.endswith('</div>'):
    pass # ok

# 3. Transform table HTML for followups
table_html = table_html.replace(
    """<tr *ngFor="let lead of leadsInSelectedCompany" class="lead-table-row">""",
    """<ng-container *ngFor="let b of filteredBookmarksByGlobalCompany">\n                      <tr *ngIf="getMatchedLeadForAdminBookmark(b) as matchedLead" class="lead-table-row">"""
)
table_html = table_html.replace("</tr>", "</tr>\n                      </ng-container>")

# Variable replacements
table_html = table_html.replace("lead.", "matchedLead.")
table_html = table_html.replace("matchedLead.contactName", "(b.contactName || matchedLead.contactName)")
table_html = table_html.replace("matchedLead.contactNumber", "(b.contactNumber || matchedLead.contactNumber)")

# Wrapper *ngIf replacement
table_html = table_html.replace(
    "adminLeadViewMode === 'table' && leadsInSelectedCompany.length > 0",
    "adminFollowupViewMode === 'table' && filteredBookmarksByGlobalCompany.length > 0"
)
table_html = table_html.replace("deleteAdminLead(", "adminDeleteLead(")

# 4. Inject into followups
grid_start = '<div *ngIf="selectedGlobalFollowupCompany" class="lead-card-grid'
grid_new_start = '<div *ngIf="selectedGlobalFollowupCompany && adminFollowupViewMode === \'grid\'" class="lead-card-grid'
followups_html = followups_html.replace(grid_start, grid_new_start, 1)

# Inject table html before the grid
injection_point = '              <!-- Lead Cards Grid -->\n              <div *ngIf="selectedGlobalFollowupCompany && adminFollowupViewMode'
followups_html = followups_html.replace(
    injection_point,
    '              ' + table_html + '\n\n' + injection_point
)

with open(followups_path, 'w') as f:
    f.write(followups_html)

print("HTML Patched")
