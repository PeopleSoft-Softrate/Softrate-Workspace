import { Injectable } from '@angular/core';
import QRCode from 'qrcode';
import { ApiService } from '../../../services/api.service';
import { Lead } from '../../../services/lead.service';
import { formatInvoiceMoney as formatInvoiceMoneyValue, numberToWords } from '../domain/invoice-formatters';

@Injectable({ providedIn: 'root' })
export class AdminInvoiceQuotationWorkflow {
  constructor(private api: ApiService) {}

  private async setInvoiceQrFromUrl(vm: any, publicUrl: string): Promise<void> {
    vm.currentInvoicePublicUrl = publicUrl || '';
    vm.currentInvoiceQrDataUrl = '';
    if (!publicUrl) return;
    try {
      vm.currentInvoiceQrDataUrl = await QRCode.toDataURL(publicUrl, {
        width: 136,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      });
    } catch {
      vm.currentInvoiceQrDataUrl = '';
    }
  }

  private async ensureInvoiceQr(vm: any): Promise<void> {
    if (!vm.currentInvoicePublicUrl || vm.currentInvoiceQrDataUrl) return;
    await this.setInvoiceQrFromUrl(vm, vm.currentInvoicePublicUrl);
  }

  private printFallback(): void {
    window.setTimeout(() => window.print(), 50);
  }

  private collectPrintHeadMarkup(): string {
    return Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');
  }

  private waitForPrintAssets(doc: Document): Promise<void> {
    const images = Array.from(doc.images || []);
    const imageReady = Promise.all(images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const complete = () => resolve();
        img.addEventListener('load', complete, { once: true });
        img.addEventListener('error', complete, { once: true });
      });
    }));
    const fontSet = (doc as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    const fontsReady = fontSet?.ready ? fontSet.ready.catch(() => undefined) : Promise.resolve();
    return Promise.all([imageReady, fontsReady]).then(() => undefined);
  }

  private buildPrintDocument(previewHtml: string): string {
    const headMarkup = this.collectPrintHeadMarkup();
    const baseHref = String(document.baseURI || window.location.href).replace(/"/g, '&quot;');
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <base href="${baseHref}">
    ${headMarkup}
    <style>
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }

      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .admin-print-root,
      .admin-print-root * {
        visibility: visible !important;
      }

      .admin-print-root {
        width: 194mm !important;
        margin: 8mm auto !important;
        padding: 0 !important;
        background: #ffffff !important;
        box-sizing: border-box !important;
      }

      .admin-print-root .admin-quote-modal,
      .admin-print-root .invoice-builder {
        display: block !important;
        width: 194mm !important;
        max-width: 194mm !important;
        margin: 0 auto !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }

      .admin-print-root .invoice-preview {
        display: block !important;
        width: 194mm !important;
        max-width: 194mm !important;
        min-height: 281mm !important;
        height: auto !important;
        margin: 0 auto !important;
        padding: 0 !important;
        overflow: visible !important;
        border-radius: 0 !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }

      .admin-print-root .invoice-preview:not(.quotation-preview) {
        display: flex !important;
        flex-direction: column !important;
      }

      .admin-print-root .quotation-hero {
        display: grid !important;
        visibility: visible !important;
      }

      .admin-print-root .quotation-page {
        page-break-after: always !important;
        break-after: page !important;
      }

      .admin-print-root .quotation-page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }

      .admin-print-root .quotation-page + .quotation-page {
        margin-top: 0 !important;
      }

      @page {
        size: A4 portrait;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div class="admin-print-root">
      <div class="admin-quote-modal">
        <div class="invoice-builder">
          ${previewHtml}
        </div>
      </div>
    </div>
  </body>
</html>`;
  }

  private printCurrentDocument(): void {
    window.setTimeout(() => {
      const preview = document.getElementById('invoice-preview');
      if (!preview) {
        this.printFallback();
        return;
      }

      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentDocument;
      const frameWindow = iframe.contentWindow;
      if (!frameDoc || !frameWindow) {
        iframe.remove();
        this.printFallback();
        return;
      }

      frameDoc.open();
      frameDoc.write(this.buildPrintDocument(preview.outerHTML));
      frameDoc.close();

      const cleanup = () => window.setTimeout(() => iframe.remove(), 0);

      this.waitForPrintAssets(frameDoc).finally(() => {
        window.setTimeout(() => {
          const activeWindow = iframe.contentWindow;
          if (!activeWindow) {
            cleanup();
            this.printFallback();
            return;
          }
          const onAfterPrint = () => cleanup();
          activeWindow.addEventListener('afterprint', onAfterPrint, { once: true });
          activeWindow.focus();
          activeWindow.print();
          window.setTimeout(cleanup, 2000);
        }, 120);
      });
    }, 50);
  }

  private resetInvoicePublicLink(vm: any): void {
    vm.currentInvoicePublicUrl = '';
    vm.currentInvoiceQrDataUrl = '';
  }

  private activeInvoiceCompanySnapshot(vm: any): any {
    if (!vm.viewingSavedDocument) return null;
    return vm.currentInvoiceRecord?.companySnapshot || null;
  }

  private activeCompanyBankDetails(vm: any): any {
    return this.activeInvoiceCompanySnapshot(vm)?.bankDetails || vm.settingsBankDetails || {};
  }

  private normalizeInvoicePaymentStatus(status?: string): 'paid' | 'unpaid' {
    return String(status || '').trim().toLowerCase() === 'paid' ? 'paid' : 'unpaid';
  }

  private defaultQuotationKindNote(vm: any): string {
    return String(vm.settingsInvoiceFooter || 'We aim to provide the best software to automate your business with high quality at affordable cost.').trim();
  }

  private normalizeClient(raw: any): any {
    return {
      _id: String(raw?._id || raw?.id || ''),
      id: String(raw?.id || raw?._id || ''),
      companyCode: String(raw?.companyCode || ''),
      clientId: String(raw?.clientId || ''),
      companyName: String(raw?.companyName || raw?.leadCompanyName || ''),
      primaryContact: String(raw?.primaryContact || raw?.primaryContactName || ''),
      primaryContactName: String(raw?.primaryContactName || raw?.primaryContact || ''),
      primaryPhone: String(raw?.primaryPhone || raw?.contactNumber || ''),
      primaryEmail: String(raw?.primaryEmail || raw?.directorEmailAddress || ''),
      address: String(raw?.address || ''),
      description: String(raw?.description || ''),
      source: String(raw?.source || ''),
      status: String(raw?.status || 'Onboarded'),
      sourceLeadIds: Array.isArray(raw?.sourceLeadIds) ? raw.sourceLeadIds.map((id: any) => String(id || '')).filter(Boolean) : [],
      assignedEmployeePhones: Array.isArray(raw?.assignedEmployeePhones) ? raw.assignedEmployeePhones.map((phone: any) => String(phone || '')).filter(Boolean) : [],
      onboardedAt: String(raw?.onboardedAt || raw?.createdAt || ''),
      updatedAt: String(raw?.updatedAt || ''),
    };
  }

  private clientToLead(vm: any, client: any): any {
    return {
      _id: client.sourceLeadIds?.[0] || `client:${client.clientId}`,
      companyCode: vm.dashboardCode,
      assignedEmployeePhone: client.assignedEmployeePhones?.[0] || '',
      leadCompanyName: client.companyName,
      contactName: client.primaryContactName || client.primaryContact || 'Primary Contact',
      contactNumber: client.primaryPhone || '',
      directorEmailAddress: client.primaryEmail || '',
      address: client.address || '',
      status: 'Onboarded',
    };
  }

  fetchInvoiceRecords(vm: any): void {
    if (!vm.dashboardCode) return;
    vm.invoiceRecordsLoading = true;
    const params = new URLSearchParams({ companyCode: vm.dashboardCode });
    this.api.get<any>(`/api/invoices?${params.toString()}`).subscribe({
      next: (res) => {
        vm.invoiceRecordsLoading = false;
        vm.invoiceRecords = res?.success ? (res.invoices || []) : [];
      },
      error: () => {
        vm.invoiceRecordsLoading = false;
      },
    });
  }

  fetchAdminInvoiceClients(vm: any): void {
    if (!vm.dashboardCode) return;
    vm.adminInvoiceClientsLoading = true;
    const params = new URLSearchParams({
      companyCode: vm.dashboardCode,
      search: vm.invoiceSearch.trim(),
      page: '1',
      pageSize: '200',
    });
    this.api.get<any>(`/api/clients?${params.toString()}`).subscribe({
      next: (res) => {
        vm.adminInvoiceClientsLoading = false;
        const rawClients = Array.isArray(res?.clients) ? res.clients : (res?.items || []);
        vm.adminInvoiceClients = rawClients.map((client: any) => this.normalizeClient(client));
      },
      error: () => {
        vm.adminInvoiceClientsLoading = false;
        vm.adminInvoiceClients = [];
      },
    });
  }

  fetchClientOnboardingRecords(vm: any): void {
    if (!vm.dashboardCode) return;
    vm.clientOnboardingLoading = true;
    const params = new URLSearchParams({
      companyCode: vm.dashboardCode,
      search: vm.clientOnboardingSearch.trim(),
      page: '1',
      pageSize: '200',
    });
    this.api.get<any>(`/api/clients?${params.toString()}`).subscribe({
      next: (res) => {
        vm.clientOnboardingLoading = false;
        const rawClients = Array.isArray(res?.clients) ? res.clients : (res?.items || []);
        vm.clientOnboardingRecords = rawClients.map((client: any) => this.normalizeClient(client));
        if (!vm.selectedOnboardingClientId && vm.clientOnboardingRecords.length) {
          vm.selectedOnboardingClientId = vm.clientOnboardingRecords[0].clientId;
        }
      },
      error: () => {
        vm.clientOnboardingLoading = false;
        vm.clientOnboardingRecords = [];
      },
    });
  }

  submitClientOnboarding(vm: any): void {
    if (!vm.dashboardCode || vm.clientOnboardingSaving) return;
    const companyName = String(vm.clientOnboardingDraft.companyName || '').trim();
    if (!companyName) {
      vm.clientOnboardingError = 'Company name is required.';
      return;
    }

    vm.clientOnboardingSaving = true;
    vm.clientOnboardingError = '';
    vm.clientOnboardingSuccess = '';
    this.api.post<any>('/api/clients', {
      companyCode: vm.dashboardCode,
      createdByRole: 'admin',
      createdByName: vm.dashboardCompany,
      companyName,
      primaryContactName: String(vm.clientOnboardingDraft.primaryContactName || '').trim(),
      primaryPhone: String(vm.clientOnboardingDraft.primaryPhone || '').trim(),
      primaryEmail: String(vm.clientOnboardingDraft.primaryEmail || '').trim(),
      address: String(vm.clientOnboardingDraft.address || '').trim(),
    }).subscribe({
      next: (res) => {
        vm.clientOnboardingSaving = false;
        if (!res?.success || !res.client) {
          vm.clientOnboardingError = res?.message || 'Failed to onboard client.';
          return;
        }
        const client = this.normalizeClient(res.client);
        vm.selectedOnboardingClientId = client.clientId;
        vm.clientOnboardingSuccess = `Client ${client.clientId} onboarded.`;
        vm.clientOnboardingDraft = {
          companyName: '',
          primaryContactName: '',
          primaryPhone: '',
          primaryEmail: '',
          address: '',
        };
        this.fetchClientOnboardingRecords(vm);
        this.fetchAdminInvoiceClients(vm);
      },
      error: (err) => {
        vm.clientOnboardingSaving = false;
        vm.clientOnboardingError = err?.error?.message || 'Failed to onboard client.';
        const duplicateClient = err?.error?.client ? this.normalizeClient(err.error.client) : null;
        if (duplicateClient?.clientId) vm.selectedOnboardingClientId = duplicateClient.clientId;
      },
    });
  }

  resetClientOnboardingDraft(vm: any): void {
    vm.clientOnboardingDraft = {
      companyName: '',
      primaryContactName: '',
      primaryPhone: '',
      primaryEmail: '',
      address: '',
    };
    vm.clientOnboardingError = '';
    vm.clientOnboardingSuccess = '';
  }

  selectOnboardingClient(vm: any, client: any): void {
    vm.selectedOnboardingClientId = client.clientId;
  }

  selectedOnboardingClient(vm: any): any {
    return (vm.clientOnboardingRecords || []).find((client: any) => client.clientId === vm.selectedOnboardingClientId) || null;
  }

  adminConvertedInvoiceLeads(vm: any): Lead[] {
    const statuses = (vm.settingsConvertedPageStatuses?.length ? vm.settingsConvertedPageStatuses : ['Converted'])
      .map((status: string) => String(status).toLowerCase());
    const query = vm.invoiceSearch.trim().toLowerCase();
    return vm.allLeads
      .filter((lead: Lead) => statuses.includes(String(lead.status || '').toLowerCase()))
      .filter((lead: Lead) => {
        if (!query) return true;
        return [
          lead.leadCompanyName,
          lead.contactName,
          lead.contactNumber,
          lead.directorEmailAddress,
          lead.assignedEmployeePhone,
        ].some((value) => String(value || '').toLowerCase().includes(query));
      })
      .slice(0, 200);
  }

  adminQuotationLeads(vm: any): Lead[] {
    const query = vm.quotationSearch.trim().toLowerCase();
    return vm.allLeads
      .filter((lead: Lead) => {
        if (!query) return true;
        return [
          lead.leadCompanyName,
          lead.contactName,
          lead.contactNumber,
          lead.directorEmailAddress,
          lead.assignedEmployeePhone,
        ].some((value) => String(value || '').toLowerCase().includes(query));
      })
      .slice(0, 200);
  }

  filteredInvoiceRecords(vm: any): any[] {
    const query = vm.invoiceHistorySearch.trim().toLowerCase();
    return vm.invoiceRecords.filter((invoice: any) => {
      const matchesSearch = !query || [
        invoice.invoiceNumber,
        invoice.clientId,
        invoice.clientSnapshot?.clientId,
        invoice.leadCompanyName,
        invoice.contactName,
        invoice.contactNumber,
        invoice.employeeName,
        invoice.employeePhone,
      ].join(' ').toLowerCase().includes(query);
      return matchesSearch && vm.matchesInvoiceDateRange(invoice.invoiceDate || invoice.createdAt);
    });
  }

  filteredQuotationRecords(vm: any): any[] {
    const query = vm.quotationHistorySearch.trim().toLowerCase();
    return vm.quotationRecords.filter((quote: any) => {
      const matchesSearch = !query || [
        quote.quotationNumber,
        quote.leadCompanyName,
        quote.contactName,
        quote.contactNumber,
        quote.employeeName,
        quote.employeePhone,
      ].join(' ').toLowerCase().includes(query);
      return matchesSearch && vm.matchesQuotationDateRange(quote.quotationDate || quote.createdAt);
    });
  }

  matchesAdminInvoiceDateFilter(vm: any, rawDate?: string): boolean {
    if (vm.invoiceDateFilter === 'all') return true;
    if (!rawDate) return false;
    const date = new Date(rawDate);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (vm.invoiceDateFilter === 'today') return date >= start;
    const days = vm.invoiceDateFilter === '7d' ? 7 : 30;
    start.setDate(start.getDate() - days + 1);
    return date >= start;
  }

  matchesInvoiceDateRange(vm: any, rawDate?: string): boolean {
    if (!rawDate) return false;
    const date = new Date(rawDate);
    if (vm.invoiceDateFrom) {
      const from = new Date(vm.invoiceDateFrom);
      from.setHours(0, 0, 0, 0);
      if (date < from) return false;
    }
    if (vm.invoiceDateTo) {
      const to = new Date(vm.invoiceDateTo);
      to.setHours(23, 59, 59, 999);
      if (date > to) return false;
    }
    return true;
  }

  matchesQuotationDateRange(vm: any, rawDate?: string): boolean {
    if (!rawDate) return false;
    const date = new Date(rawDate);
    if (vm.quotationDateFrom) {
      const from = new Date(vm.quotationDateFrom);
      from.setHours(0, 0, 0, 0);
      if (date < from) return false;
    }
    if (vm.quotationDateTo) {
      const to = new Date(vm.quotationDateTo);
      to.setHours(23, 59, 59, 999);
      if (date > to) return false;
    }
    return true;
  }

  fetchQuotationRecords(vm: any): void {
    if (!vm.dashboardCode) return;
    vm.quotationRecordsLoading = true;
    const params = new URLSearchParams({ companyCode: vm.dashboardCode });
    this.api.get<any>(`/api/quotations?${params.toString()}`).subscribe({
      next: (res) => {
        vm.quotationRecordsLoading = false;
        vm.quotationRecords = res?.success ? (res.quotations || []) : [];
      },
      error: () => {
        vm.quotationRecordsLoading = false;
      },
    });
  }

  openSavedInvoice(vm: any, record: any): void {
    vm.quoteMode = false;
    vm.viewingSavedDocument = true;
    vm.currentInvoiceRecord = record;
    vm.selectedInvoiceClient = null;
    this.resetDocumentGstSelection(vm);
    vm.currentInvoiceNumber = record.invoiceNumber || '';
    void this.setInvoiceQrFromUrl(vm, record.publicUrl || '');
    vm.invoiceLead = {
      _id: record.leadId || '',
      companyCode: vm.dashboardCode,
      assignedEmployeePhone: record.employeePhone || '',
      leadCompanyName: record.clientSnapshot?.companyName || record.leadCompanyName || '',
      contactName: record.clientSnapshot?.contactName || record.contactName || '',
      contactNumber: record.clientSnapshot?.phone || record.contactNumber || '',
      directorEmailAddress: record.clientSnapshot?.email || record.directorEmailAddress || '',
      address: record.clientSnapshot?.address || record.address || '',
      status: '',
    };
    vm.invoiceIssuedAt = record.invoiceDate ? new Date(record.invoiceDate) : new Date(record.createdAt || Date.now());
    vm.invoicePaymentStatus = this.normalizeInvoicePaymentStatus(record.paymentStatus);
    vm.invoiceItems = (record.items || []).map((item: any) => ({
      product: item.product || { name: item.name, sacHsn: item.sacHsn || '' },
      name: item.name || item.product?.name || 'Service',
      price: Number(item.rate ?? item.price ?? 0),
      quantity: Number(item.quantity || 1),
    }));
    vm.showInvoiceModal = true;
  }

  openSavedQuotation(vm: any, record: any): void {
    vm.quoteMode = true;
    vm.viewingSavedDocument = true;
    vm.currentInvoiceRecord = record;
    vm.selectedInvoiceClient = null;
    this.resetDocumentGstSelection(vm);
    vm.currentQuotationNumber = record.quotationNumber || '';
    this.resetInvoicePublicLink(vm);
    vm.invoiceLead = {
      _id: record.leadId || '',
      companyCode: vm.dashboardCode,
      assignedEmployeePhone: record.employeePhone || '',
      leadCompanyName: record.leadCompanyName || '',
      contactName: record.contactName || '',
      contactNumber: record.contactNumber || '',
      directorEmailAddress: record.directorEmailAddress || '',
      address: record.clientSnapshot?.address || record.address || '',
      status: '',
    };
    vm.invoiceIssuedAt = record.quotationDate ? new Date(record.quotationDate) : new Date(record.createdAt || Date.now());
    vm.invoicePaymentStatus = 'unpaid';
    vm.quotationKindNoteDraft = String(record.kindNote || record.companySnapshot?.footer || this.defaultQuotationKindNote(vm));
    vm.invoiceItems = (record.items || []).map((item: any) => ({
      product: item.product || { name: item.name, sacHsn: item.sacHsn || '' },
      name: item.name || item.product?.name || 'Service',
      price: Number(item.rate ?? item.price ?? 0),
      quantity: Number(item.quantity || 1),
    }));
    vm.showInvoiceModal = true;
  }

  formatInvoiceMoney(vm: any, value: number): string {
    return formatInvoiceMoneyValue(value);
  }

  private resetDocumentGstSelection(vm: any): void {
    vm.showGstSelectionModal = false;
    vm.documentGstPercentageOverride = null;
    vm.gstSelectionConfirmed = false;
  }

  openQuotationModal(vm: any, lead: Lead): void {
    vm.quoteMode = true;
    vm.viewingSavedDocument = false;
    vm.currentInvoiceRecord = null;
    vm.selectedInvoiceClient = null;
    this.resetDocumentGstSelection(vm);
    vm.invoiceLead = lead;
    vm.invoiceItems = [];
    vm.selectedInvoiceProduct = null;
    vm.invoicePrice = 0;
    vm.invoiceQuantity = 1;
    vm.invoicePaymentStatus = 'unpaid';
    vm.quotationKindNoteDraft = this.defaultQuotationKindNote(vm);
    vm.invoiceIssuedAt = new Date();
    vm.quoteNumber = Math.floor(100000 + Math.random() * 900000);
    vm.currentQuotationNumber = '';
    this.resetInvoicePublicLink(vm);
    vm.showInvoiceModal = true;
  }

  openAdminInvoiceModal(vm: any, lead: Lead): void {
    vm.quoteMode = false;
    vm.viewingSavedDocument = false;
    vm.currentInvoiceRecord = null;
    vm.selectedInvoiceClient = null;
    this.resetDocumentGstSelection(vm);
    vm.invoiceLead = lead;
    vm.invoiceItems = [];
    vm.selectedInvoiceProduct = null;
    vm.invoicePrice = 0;
    vm.invoiceQuantity = 1;
    vm.invoicePaymentStatus = 'unpaid';
    vm.quotationKindNoteDraft = this.defaultQuotationKindNote(vm);
    vm.invoiceIssuedAt = new Date();
    vm.quoteNumber = Math.floor(100000 + Math.random() * 900000);
    vm.currentInvoiceNumber = '';
    this.resetInvoicePublicLink(vm);
    vm.showInvoiceModal = true;
  }

  openAdminInvoiceModalForClient(vm: any, client: any): void {
    const normalizedClient = this.normalizeClient(client);
    vm.quoteMode = false;
    vm.viewingSavedDocument = false;
    vm.currentInvoiceRecord = null;
    vm.selectedInvoiceClient = normalizedClient;
    this.resetDocumentGstSelection(vm);
    vm.invoiceLead = this.clientToLead(vm, normalizedClient);
    vm.invoiceItems = [];
    vm.selectedInvoiceProduct = null;
    vm.invoicePrice = 0;
    vm.invoiceQuantity = 1;
    vm.invoicePaymentStatus = 'unpaid';
    vm.quotationKindNoteDraft = this.defaultQuotationKindNote(vm);
    vm.invoiceIssuedAt = new Date();
    vm.quoteNumber = Math.floor(100000 + Math.random() * 900000);
    vm.currentInvoiceNumber = '';
    this.resetInvoicePublicLink(vm);
    vm.showInvoiceModal = true;
  }

  closeInvoiceModal(vm: any): void {
    vm.showInvoiceModal = false;
    vm.quoteMode = false;
    vm.viewingSavedDocument = false;
    vm.currentInvoiceRecord = null;
    vm.selectedInvoiceClient = null;
    this.resetInvoicePublicLink(vm);
    this.resetDocumentGstSelection(vm);
    vm.invoicePaymentStatus = 'unpaid';
    vm.quotationKindNoteDraft = this.defaultQuotationKindNote(vm);
  }

  onProductSelect(vm: any): void {
    if (vm.selectedInvoiceProduct) {
      vm.invoicePrice = Number(vm.selectedInvoiceProduct.minPrice || 0);
    }
  }

  addInvoiceItem(vm: any): void {
    if (!vm.selectedInvoiceProduct) return;
    const minPrice = Number(vm.selectedInvoiceProduct.minPrice || 0);
    if (Number(vm.invoicePrice || 0) < minPrice) {
      alert(`Price cannot be less than the minimum price of ${vm.formatInvoiceMoney(minPrice)}`);
      vm.invoicePrice = minPrice;
      return;
    }

    vm.invoiceItems.push({
      product: vm.selectedInvoiceProduct,
      price: Number(vm.invoicePrice || 0),
      quantity: Number(vm.invoiceQuantity || 1),
      name: vm.selectedInvoiceProduct.name,
    });
    vm.selectedInvoiceProduct = null;
    vm.invoicePrice = 0;
    vm.invoiceQuantity = 1;
  }

  removeInvoiceItem(vm: any, index: number): void {
    vm.invoiceItems.splice(index, 1);
  }

  invoiceSubtotal(vm: any): number {
    return vm.invoiceItems.reduce((sum: number, item: any) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
  }

  invoiceGstAmount(vm: any): number {
    return vm.invoiceSubtotal * (this.invoicePreviewGstPercentage(vm) / 100);
  }

  invoiceCgstAmount(vm: any): number {
    return vm.invoiceGstAmount / 2;
  }

  invoiceSgstAmount(vm: any): number {
    return vm.invoiceGstAmount / 2;
  }

  invoiceTotal(vm: any): number {
    return vm.invoiceSubtotal + vm.invoiceGstAmount;
  }

  invoiceItemTaxable(vm: any, item: { price: number; quantity: number }): number {
    return Number(item.price || 0) * Number(item.quantity || 1);
  }

  invoiceItemGst(vm: any, item: { price: number; quantity: number }): number {
    return this.invoiceItemTaxable(vm, item) * (this.invoicePreviewGstPercentage(vm) / 100);
  }

  invoiceItemTotal(vm: any, item: { price: number; quantity: number }): number {
    return this.invoiceItemTaxable(vm, item) + this.invoiceItemGst(vm, item);
  }
  invoiceNumber(vm: any): string {
    if (vm.quoteMode && vm.currentQuotationNumber) return vm.currentQuotationNumber;
    if (!vm.quoteMode && vm.currentInvoiceNumber) return vm.currentInvoiceNumber;
    const issued = vm.invoiceIssuedAt || new Date();
    const yyyy = String(issued.getFullYear());
    const mm = String(issued.getMonth() + 1).padStart(2, '0');
    const sequence = String(vm.quoteNumber % 1000 || 1).padStart(3, '0');
    return `${vm.quoteMode ? 'Quote' : 'Invoice'}_${yyyy}${mm}${sequence}_v1.pdf`;
  }

  invoiceCompanyDisplayName(vm: any): string {
    const snapshotName = String(this.activeInvoiceCompanySnapshot(vm)?.name || '').trim();
    if (snapshotName) return snapshotName;
    return (vm.settingsShowCompanyNameOnInvoice ? (vm.settingsCompanyName || vm.dashboardCompany) : '') || 'DealVoice';
  }

  invoiceCompanyAddress(vm: any): string {
    return String(
      this.activeInvoiceCompanySnapshot(vm)?.registeredAddress ||
      this.activeInvoiceCompanySnapshot(vm)?.address ||
      vm.settingsInvoiceRegisteredAddress ||
      vm.companyProfile?.companyAddress ||
      '',
    ).trim();
  }

  invoiceContactLine(vm: any): string {
    const snapshot = this.activeInvoiceCompanySnapshot(vm);
    const parts = [
      snapshot?.phone || vm.settingsContactDetails?.phone || '',
      snapshot?.email || vm.settingsContactDetails?.email || '',
      snapshot?.website || vm.settingsContactDetails?.website || '',
    ]
      .map((value: any) => String(value || '').trim())
      .filter(Boolean);
    return parts.join(' · ');
  }

  quotationBankRows(vm: any): Array<{ label: string; value: string }> {
    const bankDetails = this.activeCompanyBankDetails(vm);
    return [
      { label: 'Bank', value: bankDetails.bankName },
      { label: 'Acc', value: bankDetails.accountNumber },
      { label: 'IFSC', value: bankDetails.ifscCode },
      { label: 'Branch', value: bankDetails.branchName },
    ]
      .map((row) => ({ ...row, value: String(row.value || '').trim() }))
      .filter((row) => row.value);
  }

  quotationKindNoteText(vm: any): string {
    return String(
      vm.currentInvoiceRecord?.kindNote ||
      vm.quotationKindNoteDraft ||
      this.activeInvoiceCompanySnapshot(vm)?.footer ||
      this.defaultQuotationKindNote(vm),
    ).trim();
  }

  formatInvoicePaymentStatus(vm: any, status?: string): string {
    return this.normalizeInvoicePaymentStatus(status || vm.invoicePaymentStatus) === 'paid' ? 'Paid' : 'Unpaid';
  }

  invoiceBankDetails(vm: any): any {
    return this.activeCompanyBankDetails(vm);
  }

  invoiceSealSrc(vm: any): string {
    return String(this.activeInvoiceCompanySnapshot(vm)?.seal || vm.settingsInvoiceSeal || '').trim();
  }

  invoiceTermsText(vm: any): string {
    return String(this.activeInvoiceCompanySnapshot(vm)?.terms || vm.settingsInvoiceTerms || '').trim();
  }

  invoicePreviewGstPercentage(vm: any): number {
    if (vm.viewingSavedDocument) {
      return Number(vm.currentInvoiceRecord?.gstPercentage || 0);
    }
    if (vm.documentGstPercentageOverride !== null && vm.documentGstPercentageOverride !== undefined) {
      return Number(vm.documentGstPercentageOverride || 0);
    }
    return Number(vm.settingsGstPercentage || 0);
  }

  confirmDocumentGstSelection(vm: any, useZeroGst: boolean): void {
    vm.documentGstPercentageOverride = useZeroGst ? 0 : null;
    vm.gstSelectionConfirmed = true;
    vm.showGstSelectionModal = false;
    this.printInvoice(vm);
  }

  cancelDocumentGstSelection(vm: any): void {
    vm.showGstSelectionModal = false;
  }

  printInvoice(vm: any): void {
    if (vm.invoiceItems.length === 0) {
      alert(`Please add at least one product to the ${vm.quoteMode ? 'quotation' : 'invoice'}.`);
      return;
    }
    if (vm.viewingSavedDocument) {
      this.ensureInvoiceQr(vm).finally(() => this.printCurrentDocument());
      return;
    }
    if (!vm.gstSelectionConfirmed) {
      vm.showGstSelectionModal = true;
      return;
    }
    if (vm.quoteMode) {
      vm.saveAndPrintQuotation();
      return;
    }
    if (!vm.invoiceLead || vm.invoiceSaving) return;

    const invoiceClient = vm.selectedInvoiceClient;
    const sourceLeadId = invoiceClient?.sourceLeadIds?.[0] || vm.invoiceLead._id;
    vm.invoiceSaving = true;
    this.api.post<any>('/api/invoices', {
      companyCode: vm.dashboardCode,
      employeePhone: vm.invoiceLead.assignedEmployeePhone,
      employeeName: vm.getEmployeeName(vm.invoiceLead.assignedEmployeePhone),
      createdByRole: 'admin',
      createdByName: vm.dashboardCompany,
      clientId: invoiceClient?.clientId || undefined,
      leadId: sourceLeadId,
      contactNumber: vm.invoiceLead.contactNumber,
      gstPercentage: this.invoicePreviewGstPercentage(vm),
      invoiceDate: vm.invoiceIssuedAt,
      paymentStatus: this.normalizeInvoicePaymentStatus(vm.invoicePaymentStatus),
      items: vm.invoiceItems.map((item: any) => ({
        productId: item.product?._id,
        name: item.name,
        rate: item.price,
        quantity: item.quantity,
        sacHsn: item.product?.sacHsn || '',
      })),
    }).subscribe({
      next: (res) => {
        vm.invoiceSaving = false;
        if (!res?.success || !res.invoice) {
          alert(res?.message || 'Failed to save invoice.');
          return;
        }
        vm.currentInvoiceNumber = res.invoice.invoiceNumber;
        vm.fetchInvoiceRecords();
        void this.setInvoiceQrFromUrl(vm, res.invoice.publicUrl || '').finally(() => this.printCurrentDocument());
      },
      error: (err) => {
        vm.invoiceSaving = false;
        alert(err?.error?.message || 'Failed to save invoice.');
      },
    });
  }

  saveAndPrintQuotation(vm: any): void {
    if (!vm.invoiceLead || vm.quotationSaving) return;
    vm.quotationSaving = true;
    this.api.post<any>('/api/quotations', {
      companyCode: vm.dashboardCode,
      employeePhone: vm.invoiceLead.assignedEmployeePhone,
      employeeName: vm.getEmployeeName(vm.invoiceLead.assignedEmployeePhone),
      createdByRole: 'admin',
      createdByName: vm.dashboardCompany,
      leadId: vm.invoiceLead._id,
      contactNumber: vm.invoiceLead.contactNumber,
      gstPercentage: this.invoicePreviewGstPercentage(vm),
      quotationDate: vm.invoiceIssuedAt,
      kindNote: this.quotationKindNoteText(vm),
      items: vm.invoiceItems.map((item: any) => ({
        productId: item.product?._id,
        name: item.name,
        rate: item.price,
        quantity: item.quantity,
      })),
    }).subscribe({
      next: (res) => {
        vm.quotationSaving = false;
        if (!res?.success || !res.quotation) {
          alert(res?.message || 'Failed to save quotation.');
          return;
        }
        vm.currentQuotationNumber = res.quotation.quotationNumber;
        vm.quotationKindNoteDraft = String(res.quotation.kindNote || this.quotationKindNoteText(vm));
        vm.fetchQuotationRecords();
        this.printCurrentDocument();
      },
      error: (err) => {
        vm.quotationSaving = false;
        alert(err?.error?.message || 'Failed to save quotation.');
      },
    });
  }

  createAdminInvoiceForLead(vm: any, lead: Lead): void {
    if (!lead?._id || vm.invoiceSavingLeadId) return;
    const product = vm.settingsProducts[0];
    if (!product) {
      alert('Add at least one invoice service in Invoice Settings before generating invoices.');
      return;
    }

    vm.invoiceSavingLeadId = lead._id;
    this.api.post<any>('/api/invoices', {
      companyCode: vm.dashboardCode,
      employeePhone: lead.assignedEmployeePhone,
      employeeName: vm.employees.find((emp: any) => emp.mobile === lead.assignedEmployeePhone)?.name || '',
      createdByRole: 'admin',
      createdByName: vm.dashboardCompany,
      leadId: lead._id,
      contactNumber: lead.contactNumber,
      gstPercentage: vm.settingsGstPercentage,
      items: [{
        name: product.name,
        rate: product.minPrice || 0,
        quantity: 1,
      }],
    }).subscribe({
      next: (res) => {
        vm.invoiceSavingLeadId = '';
        if (!res?.success) {
          alert(res?.message || 'Failed to save invoice.');
          return;
        }
        vm.fetchInvoiceRecords();
      },
      error: (err) => {
        vm.invoiceSavingLeadId = '';
        alert(err?.error?.message || 'Failed to save invoice.');
      },
    });
  }

  numberToWords(vm: any, value: number): string {
    return numberToWords(value);
  }

  getGstBreakdown(vm: any): any[] {
    const breakdownMap = new Map<string, any>();
    const gstPct = this.invoicePreviewGstPercentage(vm);

    (vm.invoiceItems || []).forEach((item: any) => {
      const hsn = item.product?.sacHsn || item.product?.hsn || '—';
      const taxable = this.invoiceItemTaxable(vm, item);
      const cgst = this.invoiceItemGst(vm, item) / 2;
      const sgst = this.invoiceItemGst(vm, item) / 2;

      if (breakdownMap.has(hsn)) {
        const existing = breakdownMap.get(hsn)!;
        existing.taxableValue += taxable;
        existing.cgstAmount += cgst;
        existing.sgstAmount += sgst;
        existing.totalTax += (cgst + sgst);
      } else {
        breakdownMap.set(hsn, {
          hsnSac: hsn,
          taxableValue: taxable,
          cgstRate: gstPct / 2,
          cgstAmount: cgst,
          sgstRate: gstPct / 2,
          sgstAmount: sgst,
          totalTax: cgst + sgst
        });
      }
    });

    return Array.from(breakdownMap.values());
  }

  getTotalItemsQty(vm: any): number {
    return (vm.invoiceItems || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 1), 0);
  }
}
