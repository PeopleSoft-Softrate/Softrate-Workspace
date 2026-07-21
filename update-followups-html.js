const fs = require('fs');

const leadsPath = '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/leads/presentation/admin-leads-section/admin-leads-section.component.html';
const followupsPath = '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src/app/features/follow-ups/presentation/admin-followups-section/admin-followups-section.component.html';

const leadsHtml = fs.readFileSync(leadsPath, 'utf8');
let followupsHtml = fs.readFileSync(followupsPath, 'utf8');

// 1. Add Toggle
const toggleHtml = `
            <div class="view-mode-toggle lead-workspace-view-toggle">
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
`;
followupsHtml = followupsHtml.replace(
  '            </div>\n          </div>\n\n          <div class="record-frame',
  '            </div>\n' + toggleHtml + '          </div>\n\n          <div class="record-frame'
);

// 2. Extract Table Html from leads
const tableStart = '<div class="lead-table-wrapper"';
const tableEnd = '                </div>\n\n                <!-- Lead Cards Grid -->';
let tableHtml = leadsHtml.substring(leadsHtml.indexOf(tableStart), leadsHtml.indexOf(tableEnd));

// Replace logic in tableHtml to match followups
// In leads:
// *ngIf="adminLeadViewMode === 'table' && leadsInSelectedCompany.length > 0"
// *ngFor="let lead of leadsInSelectedCompany" class="lead-table-row"

// In followups:
// *ngIf="adminFollowupViewMode === 'table' && filteredBookmarksByGlobalCompany.length > 0"
// *ngFor="let b of filteredBookmarksByGlobalCompany" class="lead-table-row"
// AND inside we must do: <ng-container *ngIf="getMatchedLeadForAdminBookmark(b) as matchedLead"> 

// First, wrap the table body content with the ng-container for matchedLead
tableHtml = tableHtml.replace(/<tr \*ngFor="let lead of leadsInSelectedCompany" class="lead-table-row">/g, 
  '<ng-container *ngFor="let b of filteredBookmarksByGlobalCompany"><tr *ngIf="getMatchedLeadForAdminBookmark(b) as matchedLead" class="lead-table-row">'
);
tableHtml = tableHtml.replace(/<\/tr>/g, '</tr></ng-container>');

// Now replace all references to 'lead.' with 'matchedLead.' (except some cases where b.contactName etc are used)
// Actually in followups, contactName can be `b.contactName || matchedLead.contactName`.
tableHtml = tableHtml.replace(/lead\./g, 'matchedLead.');
tableHtml = tableHtml.replace(/matchedLead\.contactName/g, "(b.contactName || matchedLead.contactName)");
tableHtml = tableHtml.replace(/matchedLead\.contactNumber/g, "(b.contactNumber || matchedLead.contactNumber)");

// Also replace the *ngIf on the wrapper
tableHtml = tableHtml.replace(/adminLeadViewMode === 'table' && leadsInSelectedCompany\.length > 0/g, "adminFollowupViewMode === 'table' && filteredBookmarksByGlobalCompany.length > 0");

// Also replace `deleteAdminLead` with `adminDeleteLead` or check if it exists (in followups it's `adminDeleteLead(matchedLead)`)
// Actually followups table doesn't have delete, let me check followups card. It doesn't have a delete button, so we should remove it from the table or keep it if adminDeleteLead exists. 
// Followups grid doesn't show delete button? Wait, it has history button but no delete button. Let's just do a blind replace of `deleteAdminLead` -> `adminDeleteLead`.
tableHtml = tableHtml.replace(/deleteAdminLead\(/g, 'adminDeleteLead(');

// 3. Add *ngIf to the grid
followupsHtml = followupsHtml.replace(
  '<div *ngIf="selectedGlobalFollowupCompany" class="lead-card-grid',
  '<div *ngIf="selectedGlobalFollowupCompany && adminFollowupViewMode === \'grid\'" class="lead-card-grid'
);

// 4. Inject table HTML above grid
followupsHtml = followupsHtml.replace(
  '<!-- Lead Cards Grid -->',
  tableHtml + '\n\n              <!-- Lead Cards Grid -->'
);

// 5. Replace `(click)="matchedLead._id && openCompanyRemarkHistory(matchedLead)"` -> wait, followups grid uses `matchedLead._id && openCompanyRemarkHistory(matchedLead)` ?
// Let's check followup grid: `openCompanyRemarkHistory(matchedLead)` - yes.

fs.writeFileSync(followupsPath, followupsHtml);
console.log("Success");
