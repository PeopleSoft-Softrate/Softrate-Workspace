const fs = require('fs');

const fields = [
  { key: 'cin', label: 'CIN' },
  { key: 'dateOfIncorporation', label: 'Date Of Incorporation' },
  { key: 'companyEmail', label: 'Company Email' },
  { key: 'authorisedCapital', label: 'Authorised Capital' },
  { key: 'paidUpCapital', label: 'PaidUp Capital' },
  { key: 'totalObligationOfContribution', label: 'Total Obligation' },
  { key: 'addressType', label: 'Address Type' },
  { key: 'streetAddressLine1', label: 'Street Address Line 1' },
  { key: 'streetAddressLine2', label: 'Street Address Line 2' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'postalCode', label: 'Postal Code' },
  { key: 'directorDin', label: 'Director DIN' },
  { key: 'directorFirstName', label: 'Director First Name' },
  { key: 'directorLastName', label: 'Director Last Name' },
  { key: 'directorMobileNumber', label: 'Director Mobile Number' },
  { key: 'directorPermanentAddressLine1', label: 'Dir. Perm Address Line 1' },
  { key: 'directorPermanentAddressLine2', label: 'Dir. Perm Address Line 2' },
  { key: 'directorPermanentCity', label: 'Dir. Perm City' },
  { key: 'directorPermanentState', label: 'Dir. Perm State' },
  { key: 'directorPermanentPincode', label: 'Dir. Perm Pincode' },
  { key: 'directorPresentAddressLine1', label: 'Dir. Pres Address Line 1' },
  { key: 'directorPresentAddressLine2', label: 'Dir. Pres Address Line 2' },
  { key: 'directorPresentCity', label: 'Dir. Pres City' },
  { key: 'directorPresentState', label: 'Dir. Pres State' },
  { key: 'directorPresentPincode', label: 'Dir. Pres Pincode' },
  { key: 'mainDivisionNo', label: 'Main Division No' },
  { key: 'companyType', label: 'Company Type' },
  { key: 'classOfCompany', label: 'Class Of Company' },
  { key: 'companyCategory', label: 'Company Category' },
  { key: 'companySubcategory', label: 'Company Subcategory' },
  { key: 'registrationNumber', label: 'Registration Number' },
  { key: 'companyOrigin', label: 'Company Origin' },
  { key: 'roc', label: 'ROC' }
];

let dashHtml = '';
let drillHtml = '';

fields.forEach(f => {
  dashHtml += `                  <div>
                    <label style="font-size: 0.7rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${f.label}</label>
                    <select [(ngModel)]="leadColumnMapping.${f.key}" style="width: 100%; padding: 0.5rem; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.8rem;">
                      <option value="">-- Select --</option>
                      <option *ngFor="let h of excelHeaders" [value]="h">{{ h }}</option>
                    </select>
                  </div>\n`;

  drillHtml += `            <div class="form-group" style="margin:0">
              <label style="font-size: 0.75rem;">${f.label} Column</label>
              <select [(ngModel)]="leadColumnMapping.${f.key}"
                style="width:100%; padding:0.5rem; border-radius:8px; border:1px solid #cbd5e1;">
                <option value="">-- Select Column --</option>
                <option *ngFor="let h of excelHeaders" [value]="h">{{ h }}</option>
              </select>
            </div>\n`;
});

// For dash, wrap in grid rows
const dashGrid = `                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 1.5rem;">\n${dashHtml}                </div>\n`;

// Read dash file
const dashPath = 'apps/sales/admin-crm/src/app/features/employees/presentation/admin-employee-dashboard-section/admin-employee-dashboard-section.component.html';
let dashContent = fs.readFileSync(dashPath, 'utf8');

// Insert after company description in dash
const dashTarget = `                    <select [(ngModel)]="leadColumnMapping.companyDescription" style="width: 100%; padding: 0.5rem; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.8rem;">
                      <option value="">-- Select --</option>
                      <option *ngFor="let h of excelHeaders" [value]="h">{{ h }}</option>
                    </select>
                  </div>
                </div>`;
dashContent = dashContent.replace(dashTarget, dashTarget + '\n\n' + dashGrid);
fs.writeFileSync(dashPath, dashContent);

// Read drill file
const drillPath = 'apps/sales/admin-crm/src/app/features/employees/presentation/admin-employee-drilldown/admin-employee-drilldown.component.html';
let drillContent = fs.readFileSync(drillPath, 'utf8');

// Insert after company description in drill
const drillTarget = `              <select [(ngModel)]="leadColumnMapping.companyDescription"
                style="width:100%; padding:0.5rem; border-radius:8px; border:1px solid #cbd5e1;">
                <option value="">-- Select Column --</option>
                <option *ngFor="let h of excelHeaders" [value]="h">{{ h }}</option>
              </select>
            </div>`;
drillContent = drillContent.replace(drillTarget, drillTarget + '\n' + drillHtml);
fs.writeFileSync(drillPath, drillContent);

console.log("Patched successfully!");
