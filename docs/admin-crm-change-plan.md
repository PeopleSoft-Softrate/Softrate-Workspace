# Admin CRM Change Plan

Date: 2026-05-27
Scope: `apps/sales/admin-crm`
Status: Planning only. No implementation work started in this document.

## Goal

Implement the requested `admin-crm` changes in the exact order requested, while reducing regression risk in the patch-heavy admin workspace and keeping parity with the employee module where it is already the cleaner source of truth.

## Working Order

1. Overview page
2. Full view of employee
3. Invoices page
4. Quotation
5. Help and support
6. Invoice settings

## Current Findings

- Admin overview already has its own stats card, chart view state, and a `Peak Window` metric.
  - Files:
    - `apps/sales/admin-crm/src/app/features/overview/presentation/admin-overview-section/admin-overview-section.component.html`
    - `apps/sales/admin-crm/src/app/features/admin-workspace/state/admin-workspace.controller.ts`
- Admin employee full-view already has a dedicated `emp_dashboard` screen with its own `View` dropdown, while the employee list still renders `App Ver.`.
  - Files:
    - `apps/sales/admin-crm/src/app/features/employees/presentation/admin-employee-dashboard-section/admin-employee-dashboard-section.component.html`
    - `apps/sales/admin-crm/src/app/features/employees/presentation/admin-employees-section/admin-employees-section.component.html`
- Admin invoice history and invoice settings are currently rendered from the same invoice template and are differentiated by `dashTab==='invoice'` vs `dashTab==='invoice_settings'`.
  - File:
    - `apps/sales/admin-crm/src/app/features/invoices/presentation/admin-invoice-section/admin-invoice-section.component.html`
- Admin invoice/quotation printing is driven by a custom workflow plus a large admin-specific print stylesheet.
  - Files:
    - `apps/sales/admin-crm/src/app/features/invoices/presentation/admin-invoice-quotation.workflow.ts`
    - `apps/sales/admin-crm/src/app/features/invoices/presentation/styles/invoice-quotation-modals.css`
- Company full-view runs inside the shared admin modal layer and is a likely crash surface because it aggregates leads, follow-ups, remarks, invoices, and quotations in one modal.
  - File:
    - `apps/sales/admin-crm/src/app/features/admin-workspace/sections/admin-workspace-modals/admin-workspace-modals.component.html`
- The admin workspace has several patch/override style layers that need to be audited before adding more fixes.
  - Likely audit targets:
    - `apps/sales/admin-crm/src/app/features/admin-workspace/styles/admin-phase-overrides.css`
    - `apps/sales/admin-crm/src/app/features/admin-workspace/styles/final-alignment-overrides.css`
    - `apps/sales/admin-crm/src/app/features/admin-workspace/styles/admin-crm-overrides.css`
    - `apps/sales/admin-crm/src/app/features/admin-workspace/styles/admin-polish-overrides.css`
    - `apps/sales/admin-crm/src/app/features/admin-workspace/styles/employee-portal-parity.css`
- Employee module already contains cleaner reference implementations for:
  - Overview call trend and call mix
  - Invoice pane structure
  - Invoice/quotation print flow
  - Reference files:
    - `apps/sales/emp/src/app/features/workspace/employee-workspace.component.html`
    - `apps/sales/emp/src/app/features/workspace/employee-workspace.component.ts`
- Local PDF findings:
  - Present: `./DealVoice – Smart Call Tracking Platform.pdf`
  - Not found in repo: `quotation.pdf`

## Detailed Plan

### 1. Overview Page

#### Requested Changes

- Remove `Peak Window` from the statistics area.
- Replace the current left-side view behavior with a graph view matching the employee module pattern shown in `apps/sales/emp`.

#### Likely Files

- `apps/sales/admin-crm/src/app/features/overview/presentation/admin-overview-section/admin-overview-section.component.html`
- `apps/sales/admin-crm/src/app/features/admin-workspace/state/admin-workspace.controller.ts`
- Possibly one of the admin workspace style override files if layout corrections are needed.

#### Implementation Intent

- Remove `Peak Window` from both admin overview summary layouts:
  - Insight row
  - Grid summary view
- Remove or stop using the `adminPeakActivity` metric where it becomes dead code.
- Rework the overview stats card layout so the left-side experience is graph-first and visually aligned with the employee module’s `Call trend` pattern.
- Reuse existing admin chart state where possible instead of introducing another chart stack.

#### Validation

- Overview page loads without template errors.
- No `Peak Window` appears anywhere in the statistics card.
- The graph view renders for all supported periods.
- The remaining stats still show correct values after the metric removal.

### 2. Full View of Employee

#### Requested Changes

- Fix the critical crash on the employee full-view page, especially if it is caused by layered patches.
- Fix the missing `View` control/behavior shown in the screenshot.
- Remove `App Ver.`.

#### Likely Files

- `apps/sales/admin-crm/src/app/features/employees/presentation/admin-employee-dashboard-section/admin-employee-dashboard-section.component.html`
- `apps/sales/admin-crm/src/app/features/employees/presentation/admin-employees-section/admin-employees-section.component.html`
- `apps/sales/admin-crm/src/app/features/employees/presentation/styles/record-layouts-employee-detail.css`
- `apps/sales/admin-crm/src/app/features/admin-workspace/state/admin-workspace.controller.ts`
- Patch-heavy workspace styles listed above

#### Implementation Intent

- Reproduce and isolate the crash path in the `emp_dashboard` flow first.
- Audit whether the crash comes from:
  - Duplicate chart initialization
  - Shared canvas IDs
  - Modal/scroll interactions
  - Excessive override CSS
  - Legacy blocks that should no longer render
- Prefer replacing brittle patch logic with cleaner parity from the employee module instead of stacking new overrides.
- Remove the `App Ver.` column from the employee list view.
- Confirm whether `App Ver.` also needs removal from any employee detail surface that still shows it.
- Ensure the `View` selector in the employee full-view actually renders and switches the chart modes correctly.

#### Validation

- `Employees` list opens without errors.
- Opening an employee into `emp_dashboard` does not crash in development or production build.
- `View` control is visible and functional.
- `App Ver.` no longer appears in the employee list.
- Call history, leads, and follow-ups still render after the cleanup.

### 3. Invoices Page

#### Requested Changes

- Fix the admin dashboard invoice page crash.
- Use the employee invoice module as the reference for the admin invoice page.
- Fix the invoice PDF typography/alignment so the bold lines are removed and the layout is consistent.

#### Likely Files

- `apps/sales/admin-crm/src/app/features/invoices/presentation/admin-invoice-section/admin-invoice-section.component.html`
- `apps/sales/admin-crm/src/app/features/admin-workspace/state/admin-workspace.controller.ts`
- `apps/sales/admin-crm/src/app/features/invoices/presentation/admin-invoice-quotation.workflow.ts`
- `apps/sales/admin-crm/src/app/features/invoices/presentation/styles/invoice-quotation-modals.css`
- Employee references:
  - `apps/sales/emp/src/app/features/workspace/employee-workspace.component.html`
  - `apps/sales/emp/src/app/features/workspace/employee-workspace.component.ts`

#### Implementation Intent

- Compare the admin invoice history/client panes against the employee invoice pane structure and move admin markup closer to the employee implementation where it reduces complexity.
- Keep admin-specific behavior only where required.
- Review the admin invoice print path:
  - save flow
  - preview rendering
  - print-document generation
  - print-only CSS
- Use `DealVoice – Smart Call Tracking Platform.pdf` as the local reference artifact for invoice print issues.
- Normalize line weights and alignments in the printable invoice so regular text stays regular unless explicit emphasis is required.

#### Validation

- Invoice dashboard page loads without crashing.
- Onboarded client list and invoice history both render.
- Opening a saved invoice still works.
- Generated/printed invoice alignment matches the in-app preview closely.
- Typography no longer has unintended bold-heavy sections.

### 4. Quotation

#### Requested Changes

- Keep the quotation preview as-is where it is already correct.
- Make the downloaded/printed quotation match the preview instead of breaking content across bad page splits.

#### Likely Files

- `apps/sales/admin-crm/src/app/features/invoices/presentation/admin-invoice-quotation.workflow.ts`
- `apps/sales/admin-crm/src/app/features/invoices/presentation/styles/invoice-quotation-modals.css`
- Quotation preview markup inside:
  - `apps/sales/admin-crm/src/app/features/admin-workspace/sections/admin-workspace-modals/admin-workspace-modals.component.html`
- Employee references:
  - `apps/sales/emp/src/app/features/workspace/employee-workspace.component.ts`
  - `apps/sales/emp/src/styles.css`

#### Implementation Intent

- Audit the admin print media rules and page-break rules for quotation mode.
- Remove the differences that cause preview and print to diverge.
- Ensure the quotation hero, service table, totals, note block, and terms sections break only where intended.
- Avoid fixing this with more one-off patches if the employee print approach can be reused cleanly.

#### Validation

- Preview and printed/downloaded quotation are visually consistent.
- No random extra pages.
- No broken table rows.
- No clipped hero/header/footer sections.

#### Note

- A local `quotation.pdf` sample was not found in the repo during planning.
- If no sample is later added, implementation should use the generated admin quotation print output as the baseline comparison against the preview.

### 5. Help and Support

#### Requested Change

- Remove the `Help & Support` title from the main screen content area.

#### Likely File

- `apps/sales/admin-crm/src/app/features/settings/presentation/admin-support-section/admin-support-section.component.html`

#### Implementation Intent

- Remove only the duplicate in-page heading.
- Keep the page accessible and preserve the topbar/title context already provided by the admin shell.

#### Validation

- Only one `Help & Support` title remains visible on the screen.

### 6. Invoice Settings

#### Requested Change

- Remove the `Invoice History` panel from `Invoice Settings`.

#### Likely File

- `apps/sales/admin-crm/src/app/features/invoices/presentation/admin-invoice-section/admin-invoice-section.component.html`

#### Implementation Intent

- Keep `Invoice History` visible for the actual invoice page.
- Hide/remove the history pane only when `dashTab==='invoice_settings'`.
- Preserve:
  - onboarded clients list if still needed there
  - settings cards
  - save action

#### Validation

- `Invoice Settings` no longer shows `Invoice History`.
- `Invoice` page behavior is unchanged unless intentionally refactored in step 3.

## Verification Plan

After each implementation step, validate with the smallest reliable scope before moving to the next step.

### Build Checks

- `cd apps/sales/admin-crm && npm run build`

### Manual UI Checks

- Overview: period switch, chart render, stats render
- Employees: open employee, switch chart view, scroll lists, remove app version
- Invoices: load page, open record, print preview, save invoice
- Quotation: preview vs print
- Help and Support: duplicate title removal
- Invoice Settings: history removal only in settings mode

## Execution Notes

- Do not add more patch layers before checking whether an existing override can be removed.
- Prefer borrowing stable structure from `apps/sales/emp` where the UI already matches the requested behavior.
- For the employee full-view crash, treat production build verification as mandatory before considering the step complete.
