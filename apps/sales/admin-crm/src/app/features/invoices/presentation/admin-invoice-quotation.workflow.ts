import { Injectable } from '@angular/core';
import QRCode from 'qrcode';
import { firstValueFrom } from 'rxjs';
import { DashboardCacheService } from '../../../core/cache/dashboard-cache.service';
import { HISTORY_PAGE_SIZE, OPERATIONAL_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../../../core/config/pagination.config';
import { ApiService } from '../../../services/api.service';
import { Lead, LeadService } from '../../../services/lead.service';
import { formatInvoiceMoney as formatInvoiceMoneyValue, numberToWords } from '../domain/invoice-formatters';

interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminInvoiceQuotationWorkflow {
  private readonly emptyBankDetails = Object.freeze({
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
  });

  constructor(
    private api: ApiService,
    private leadService: LeadService,
    private dashboardCache: DashboardCacheService,
  ) {}

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
    const isQuotation = previewHtml.includes('quotation-preview');
    const rootClass = isQuotation ? 'admin-print-root quotation-print-root' : 'admin-print-root';
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

      .admin-print-root {
        width: 210mm !important;
        min-height: 297mm !important;
        margin: 0 auto !important;
        padding: 8mm !important;
        background: #ffffff !important;
        box-sizing: border-box !important;
      }

      .quotation-print-root {
        padding: 8mm !important;
      }

      .admin-print-root .admin-quote-modal,
      .admin-print-root .invoice-builder {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 auto !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }

      .admin-print-root .invoice-preview {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        min-height: 281mm !important;
        height: auto !important;
        margin: 0 auto !important;
        padding: 0 !important;
        overflow: visible !important;
        border-radius: 0 !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }

      .quotation-print-root .admin-quote-modal,
      .quotation-print-root .invoice-builder,
      .quotation-print-root .invoice-preview {
        width: 100% !important;
        max-width: 100% !important;
        min-height: 0 !important;
        height: auto !important;
        margin: 0 auto !important;
        padding: 0 !important;
        overflow: visible !important;
        box-sizing: border-box !important;
      }

      .admin-print-root .invoice-preview:not(.quotation-preview) {
        display: flex !important;
        flex-direction: column !important;
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
        margin: 8mm;
      }
    </style>
  </head>
  <body>
    <div class="${rootClass}">
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

  private normalizeAppAssetUrl(value: any): string {
    const url = String(value || '').trim();
    return url.startsWith('/assets/') ? url.slice(1) : url;
  }

  private resolveInvoiceNumber(vm: any): string {
    if (vm.quoteMode && vm.currentQuotationNumber) return vm.currentQuotationNumber;
    if (!vm.quoteMode && vm.currentInvoiceNumber) return vm.currentInvoiceNumber;
    const issued = vm.invoiceIssuedAt || new Date();
    const yyyy = String(issued.getFullYear());
    const mm = String(issued.getMonth() + 1).padStart(2, '0');
    const sequence = String(vm.quoteNumber % 1000 || 1).padStart(3, '0');
    return `${vm.quoteMode ? 'Quote' : 'Invoice'}_${yyyy}${mm}${sequence}_v1.pdf`;
  }

  private resolveInvoicePreviewGstPercentage(vm: any): number {
    if (vm.viewingSavedDocument) {
      return Number(vm.currentInvoiceRecord?.gstPercentage || 0);
    }
    if (vm.documentGstPercentageOverride !== null && vm.documentGstPercentageOverride !== undefined) {
      return Number(vm.documentGstPercentageOverride || 0);
    }
    return Number(vm.settingsGstPercentage || 0);
  }

  private refreshInvoicePreviewCaches(vm: any): void {
    const snapshotName = String(this.activeInvoiceCompanySnapshot(vm)?.name || '').trim();
    const companyName = (snapshotName || (vm.settingsShowCompanyNameOnInvoice ? (vm.settingsCompanyName || vm.dashboardCompany) : '') || 'DealVoice').trim();
    const companyAddress = String(
      this.activeInvoiceCompanySnapshot(vm)?.registeredAddress ||
      this.activeInvoiceCompanySnapshot(vm)?.address ||
      vm.settingsInvoiceRegisteredAddress ||
      vm.companyProfile?.companyAddress ||
      '',
    ).trim();
    const snapshot = this.activeInvoiceCompanySnapshot(vm);
    const contactParts = [
      snapshot?.phone || vm.settingsContactDetails?.phone || '',
      snapshot?.email || vm.settingsContactDetails?.email || '',
      snapshot?.website || vm.settingsContactDetails?.website || '',
    ]
      .map((value: any) => String(value || '').trim())
      .filter(Boolean);
    const bankDetails = this.activeCompanyBankDetails(vm) || this.emptyBankDetails;
    const quotationBankRows = [
      { label: 'Bank', value: bankDetails.bankName },
      { label: 'Acc', value: bankDetails.accountNumber },
      { label: 'IFSC', value: bankDetails.ifscCode },
      { label: 'Branch', value: bankDetails.branchName },
    ]
      .map((row) => ({ ...row, value: String(row.value || '').trim() }))
      .filter((row) => row.value);
    const gstPercentage = this.resolveInvoicePreviewGstPercentage(vm);
    const normalizedItems = (vm.invoiceItems || []).map((item: any) => {
      const price = Number(item?.price || 0);
      const quantity = Number(item?.quantity || 1);
      const taxableAmount = price * quantity;
      const gstAmount = taxableAmount * (gstPercentage / 100);
      return {
        ...item,
        price,
        quantity,
        taxableAmount,
        gstAmount,
        totalAmount: taxableAmount + gstAmount,
      };
    });
    const invoiceSubtotal = normalizedItems.reduce((sum: number, item: any) => sum + item.taxableAmount, 0);
    const invoiceGstAmount = normalizedItems.reduce((sum: number, item: any) => sum + item.gstAmount, 0);
    const invoiceTotal = invoiceSubtotal + invoiceGstAmount;
    const gstBreakdownMap = new Map<string, any>();
    normalizedItems.forEach((item: any) => {
      const hsn = item.product?.sacHsn || item.product?.hsn || '—';
      const cgstAmount = item.gstAmount / 2;
      const sgstAmount = item.gstAmount / 2;
      const existing = gstBreakdownMap.get(hsn);
      if (existing) {
        existing.taxableValue += item.taxableAmount;
        existing.cgstAmount += cgstAmount;
        existing.sgstAmount += sgstAmount;
        existing.totalTax += item.gstAmount;
        return;
      }
      gstBreakdownMap.set(hsn, {
        hsnSac: hsn,
        taxableValue: item.taxableAmount,
        cgstRate: gstPercentage / 2,
        cgstAmount,
        sgstRate: gstPercentage / 2,
        sgstAmount,
        totalTax: item.gstAmount,
      });
    });

    vm.invoiceItems = normalizedItems;
    vm.invoiceNumberCache = this.resolveInvoiceNumber(vm);
    vm.invoiceCompanyDisplayNameCache = companyName;
    vm.invoiceCompanyAddressCache = companyAddress;
    vm.invoiceContactLineCache = contactParts.join(' · ');
    vm.invoiceBankDetailsCache = bankDetails;
    vm.quotationBankRowsCache = quotationBankRows;
    vm.invoiceLogoSrcCache = this.normalizeAppAssetUrl(this.activeInvoiceCompanySnapshot(vm)?.logo || vm.settingsInvoiceLogo || '');
    vm.invoiceSealSrcCache = this.normalizeAppAssetUrl(this.activeInvoiceCompanySnapshot(vm)?.seal || vm.settingsInvoiceSeal || '');
    vm.invoiceTermsTextCache = String(this.activeInvoiceCompanySnapshot(vm)?.terms || vm.settingsInvoiceTerms || '').trim();
    vm.quotationKindNoteTextCache = String(
      vm.currentInvoiceRecord?.kindNote ||
      vm.quotationKindNoteDraft ||
      this.activeInvoiceCompanySnapshot(vm)?.footer ||
      this.defaultQuotationKindNote(vm),
    ).trim();
    vm.invoicePreviewGstPercentageCache = gstPercentage;
    vm.invoiceSubtotalCache = invoiceSubtotal;
    vm.invoiceGstAmountCache = invoiceGstAmount;
    vm.invoiceCgstAmountCache = invoiceGstAmount / 2;
    vm.invoiceSgstAmountCache = invoiceGstAmount / 2;
    vm.invoiceTotalCache = invoiceTotal;
    vm.invoiceTotalItemsQtyCache = normalizedItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
    vm.invoiceAmountWordsCache = numberToWords(invoiceTotal);
    vm.invoiceGstBreakdownCache = Array.from(gstBreakdownMap.values());
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

  private isRefreshDue(vm: any, key: string): boolean {
    const metadata = this.dashboardCache.getMetadata(key);
    return !metadata || Date.now() - metadata.cachedAt >= vm.adminDashboardRefreshAfterMs;
  }

  private resolvePagedResponse<T>(response: any, rawItems: T[], requestedPage: number, pageSize = OPERATIONAL_PAGE_SIZE): PagedResponse<T> {
    const hasServerPageMeta = typeof response?.page === 'number'
      || typeof response?.pageSize === 'number'
      || typeof response?.total === 'number'
      || typeof response?.hasMore === 'boolean';

    if (hasServerPageMeta) {
      const page = Number(response?.page || requestedPage || 1);
      const resolvedPageSize = Number(response?.pageSize || pageSize || OPERATIONAL_PAGE_SIZE);
      const total = Number(response?.total || rawItems.length || 0);
      return {
        items: rawItems,
        page,
        pageSize: resolvedPageSize,
        total,
        hasMore: typeof response?.hasMore === 'boolean'
          ? response.hasMore
          : (page * resolvedPageSize < total),
      };
    }

    const total = rawItems.length;
    const start = Math.max(0, (requestedPage - 1) * pageSize);
    const items = rawItems.slice(start, start + pageSize);
    return {
      items,
      page: requestedPage,
      pageSize,
      total,
      hasMore: start + pageSize < total,
    };
  }

  private mergePagedItems<T>(existing: T[], incoming: T[], pickId: (item: T) => string): T[] {
    const byId = new Map(existing.map((item) => [pickId(item), item]));
    for (const item of incoming) {
      byId.set(pickId(item), item);
    }
    return Array.from(byId.values());
  }

  private adminInvoiceHistoryCacheKey(vm: any, page = 1): string {
    return [
      vm.adminInvoiceHistoryCachePrefix,
      vm.dashboardCode || '',
      vm.invoiceHistorySearch.trim(),
      vm.invoiceDateFrom || '',
      vm.invoiceDateTo || '',
      page,
    ].join('|');
  }

  private adminInvoiceClientCacheKey(vm: any, page = 1): string {
    return [
      vm.adminInvoiceClientCachePrefix,
      vm.dashboardCode || '',
      vm.invoiceSearch.trim(),
      page,
    ].join('|');
  }

  private adminQuotationHistoryCacheKey(vm: any, page = 1): string {
    return [
      vm.adminQuotationHistoryCachePrefix,
      vm.dashboardCode || '',
      vm.quotationHistorySearch.trim(),
      vm.quotationDateFrom || '',
      vm.quotationDateTo || '',
      page,
    ].join('|');
  }

  private adminQuotationLeadCacheKey(vm: any, page = 1): string {
    return [
      vm.adminQuotationLeadCachePrefix,
      vm.dashboardCode || '',
      vm.quotationSearch.trim().toLowerCase() || 'all',
      page,
    ].join('|');
  }

  private adminQuotationClientCacheKey(vm: any, page = 1): string {
    return [
      vm.adminQuotationClientCachePrefix,
      vm.dashboardCode || '',
      vm.quotationSearch.trim(),
      page,
    ].join('|');
  }

  private adminClientOnboardingCacheKey(vm: any, page = 1): string {
    return [
      vm.adminClientOnboardingCachePrefix,
      vm.dashboardCode || '',
      vm.clientOnboardingSearch.trim(),
      page,
    ].join('|');
  }

  private restoreCachedInvoiceHistoryPage(vm: any, page = 1, append = false): boolean {
    const cached = this.dashboardCache.get<PagedResponse<any>>(this.adminInvoiceHistoryCacheKey(vm, page));
    if (!cached) return false;
    vm.invoiceRecords = append
      ? this.mergePagedItems(vm.invoiceRecords, cached.items, (item) => String(item?._id || item?.id || item?.invoiceNumber || ''))
      : cached.items;
    vm.invoiceRecordsPage = cached.page;
    vm.invoiceRecordsHasMore = cached.hasMore;
    vm.invoiceRecordsTotal = cached.total;
    vm.invoiceRecordsLoaded = true;
    vm.invoiceRecordsLoading = false;
    vm.invoiceRecordsLoadingMore = false;
    return true;
  }

  private restoreCachedInvoiceClientPage(vm: any, page = 1, append = false): boolean {
    const cached = this.dashboardCache.get<PagedResponse<any>>(this.adminInvoiceClientCacheKey(vm, page));
    if (!cached) return false;
    vm.adminInvoiceClients = append
      ? this.mergePagedItems(vm.adminInvoiceClients, cached.items, (item) => String(item?.clientId || item?._id || item?.id || item?.companyName || ''))
      : cached.items;
    vm.adminInvoiceClientPage = cached.page;
    vm.adminInvoiceClientHasMore = cached.hasMore;
    vm.adminInvoiceClientTotal = cached.total;
    vm.adminInvoiceClientsLoaded = true;
    vm.adminInvoiceClientsLoading = false;
    vm.adminInvoiceClientsLoadingMore = false;
    return true;
  }

  private restoreCachedQuotationClientPage(vm: any, page = 1, append = false): boolean {
    const cached = this.dashboardCache.get<PagedResponse<any>>(this.adminQuotationClientCacheKey(vm, page));
    if (!cached) return false;
    vm.adminInvoiceClients = append
      ? this.mergePagedItems(vm.adminInvoiceClients, cached.items, (item) => String(item?.clientId || item?._id || item?.id || item?.companyName || ''))
      : cached.items;
    vm.quotationClientPage = cached.page;
    vm.quotationClientHasMore = cached.hasMore;
    vm.quotationClientTotal = cached.total;
    vm.quotationClientsLoaded = true;
    vm.adminInvoiceClientsLoading = false;
    vm.quotationClientsLoadingMore = false;
    return true;
  }

  private restoreCachedClientOnboardingPage(vm: any, page = 1, append = false): boolean {
    const cached = this.dashboardCache.get<PagedResponse<any>>(this.adminClientOnboardingCacheKey(vm, page));
    if (!cached) return false;
    vm.clientOnboardingRecords = append
      ? this.mergePagedItems(vm.clientOnboardingRecords, cached.items, (item) => String(item?.clientId || item?._id || item?.id || item?.companyName || ''))
      : cached.items;
    vm.clientOnboardingPage = cached.page;
    vm.clientOnboardingHasMore = cached.hasMore;
    vm.clientOnboardingTotal = cached.total;
    vm.clientOnboardingLoaded = true;
    vm.clientOnboardingLoading = false;
    vm.clientOnboardingLoadingMore = false;
    return true;
  }

  private restoreCachedQuotationHistoryPage(vm: any, page = 1, append = false): boolean {
    const cached = this.dashboardCache.get<PagedResponse<any>>(this.adminQuotationHistoryCacheKey(vm, page));
    if (!cached) return false;
    vm.quotationRecords = append
      ? this.mergePagedItems(vm.quotationRecords, cached.items, (item) => String(item?._id || item?.id || item?.quotationNumber || ''))
      : cached.items;
    vm.quotationRecordsPage = cached.page;
    vm.quotationRecordsHasMore = cached.hasMore;
    vm.quotationRecordsTotal = cached.total;
    vm.quotationRecordsLoaded = true;
    vm.quotationRecordsLoading = false;
    vm.quotationRecordsLoadingMore = false;
    return true;
  }

  private restoreCachedQuotationLeadPage(vm: any, page = 1, append = false): boolean {
    const cached = this.dashboardCache.get<PagedResponse<Lead>>(this.adminQuotationLeadCacheKey(vm, page));
    if (!cached) return false;
    vm.quotationLeads = append
      ? this.mergePagedItems(vm.quotationLeads, cached.items, (item) => String(item?._id || `${item?.leadCompanyName || ''}|${item?.contactNumber || ''}`))
      : cached.items;
    vm.quotationLeadsPage = cached.page;
    vm.quotationLeadsHasMore = cached.hasMore;
    vm.quotationLeadsTotal = cached.total;
    vm.quotationLeadsLoaded = true;
    vm.quotationLeadsLoading = false;
    vm.quotationLeadsLoadingMore = false;
    return true;
  }

  fetchInvoiceRecords(vm: any, force = false): void {
    void this.loadInvoiceHistoryPage(vm, 1, { reset: true, forceRefresh: force });
  }

  fetchAdminInvoiceClients(vm: any, force = false): void {
    void this.loadAdminInvoiceClientPage(vm, 1, { reset: true, forceRefresh: force });
  }

  fetchAdminQuotationClients(vm: any, force = false): void {
    void this.loadAdminQuotationClientPage(vm, 1, { reset: true, forceRefresh: force });
  }

  fetchAdminQuotationLeads(vm: any, force = false): void {
    void this.loadAdminQuotationLeadPage(vm, 1, { reset: true, forceRefresh: force });
  }

  fetchClientOnboardingRecords(vm: any, force = false): void {
    void this.loadClientOnboardingPage(vm, 1, { reset: true, forceRefresh: force });
  }

  onAdminInvoiceSearchChange(vm: any): void {
    if (vm.invoiceSearchTimeoutRef) clearTimeout(vm.invoiceSearchTimeoutRef);
    vm.invoiceSearchTimeoutRef = setTimeout(() => {
      vm.adminInvoiceClientsLoaded = false;
      void this.loadAdminInvoiceClientPage(vm, 1, { reset: true });
    }, SEARCH_DEBOUNCE_MS);
  }

  onAdminInvoiceHistoryQueryChange(vm: any): void {
    vm.invoiceRecordsLoaded = false;
    this.fetchInvoiceRecords(vm, true);
  }

  onAdminQuotationSearchChange(vm: any): void {
    if (vm.quotationSearchTimeoutRef) clearTimeout(vm.quotationSearchTimeoutRef);
    vm.quotationSearchTimeoutRef = setTimeout(() => {
      vm.quotationLeadsLoaded = false;
      void this.loadAdminQuotationLeadPage(vm, 1, { reset: true });
    }, SEARCH_DEBOUNCE_MS);
  }

  onAdminQuotationHistoryQueryChange(vm: any): void {
    vm.quotationRecordsLoaded = false;
    this.fetchQuotationRecords(vm, true);
  }

  onAdminClientOnboardingSearchChange(vm: any): void {
    if (vm.clientOnboardingSearchTimeoutRef) clearTimeout(vm.clientOnboardingSearchTimeoutRef);
    vm.clientOnboardingSearchTimeoutRef = setTimeout(() => {
      vm.clientOnboardingLoaded = false;
      vm.selectedOnboardingClientId = '';
      void this.loadClientOnboardingPage(vm, 1, { reset: true });
    }, SEARCH_DEBOUNCE_MS);
  }

  onAdminInvoiceClientScroll(vm: any, event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || vm.adminInvoiceClientsLoading || vm.adminInvoiceClientsLoadingMore || !vm.adminInvoiceClientHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      void this.loadAdminInvoiceClientPage(vm, vm.adminInvoiceClientPage + 1, { append: true });
    }
  }

  onAdminInvoiceHistoryScroll(vm: any, event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || vm.invoiceRecordsLoadingMore || !vm.invoiceRecordsHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      void this.loadInvoiceHistoryPage(vm, vm.invoiceRecordsPage + 1, { append: true, forceRefresh: true });
    }
  }

  onAdminClientOnboardingScroll(vm: any, event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || vm.clientOnboardingLoading || vm.clientOnboardingLoadingMore || !vm.clientOnboardingHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      void this.loadClientOnboardingPage(vm, vm.clientOnboardingPage + 1, { append: true, forceRefresh: true });
    }
  }

  onAdminQuotationClientScroll(vm: any, event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || vm.adminInvoiceClientsLoading || vm.quotationClientsLoadingMore || !vm.quotationClientHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      void this.loadAdminQuotationClientPage(vm, vm.quotationClientPage + 1, { append: true });
    }
  }

  onAdminQuotationLeadScroll(vm: any, event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || vm.quotationLeadsLoading || vm.quotationLeadsLoadingMore || !vm.quotationLeadsHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      void this.loadAdminQuotationLeadPage(vm, vm.quotationLeadsPage + 1, { append: true, forceRefresh: true });
    }
  }

  onAdminQuotationHistoryScroll(vm: any, event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || vm.quotationRecordsLoadingMore || !vm.quotationRecordsHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      void this.loadQuotationHistoryPage(vm, vm.quotationRecordsPage + 1, { append: true, forceRefresh: true });
    }
  }

  private async loadInvoiceHistoryPage(
    vm: any,
    page: number,
    options: { reset?: boolean; silent?: boolean; forceRefresh?: boolean; append?: boolean } = {},
  ): Promise<void> {
    if (!vm.dashboardCode) return;
    const cacheKey = this.adminInvoiceHistoryCacheKey(vm, page);
    const restored = !options.forceRefresh && this.restoreCachedInvoiceHistoryPage(vm, page, !!options.append);
    if (restored && !this.isRefreshDue(vm, cacheKey)) return;

    const silent = !!options.silent || restored;
    if (options.reset && !silent) {
      vm.invoiceRecords = [];
      vm.invoiceRecordsPage = 1;
      vm.invoiceRecordsHasMore = false;
      vm.invoiceRecordsTotal = 0;
    }
    if (options.append) {
      vm.invoiceRecordsLoadingMore = true;
    } else if (!silent) {
      vm.invoiceRecordsLoading = true;
    }

    const params = new URLSearchParams({
      companyCode: vm.dashboardCode,
      search: vm.invoiceHistorySearch.trim(),
      dateFrom: vm.invoiceDateFrom || '',
      dateTo: vm.invoiceDateTo || '',
      page: String(page),
      pageSize: String(HISTORY_PAGE_SIZE),
      paginated: 'true',
    });

    try {
      const response = await firstValueFrom(this.api.get<any>(`/api/invoices?${params.toString()}`));
      const rawItems = Array.isArray(response?.items) ? response.items : (response?.invoices || []);
      const pageResult = this.resolvePagedResponse<any>(response, rawItems, page, HISTORY_PAGE_SIZE);
      vm.invoiceRecords = options.append
        ? this.mergePagedItems(vm.invoiceRecords, pageResult.items, (item) => String(item?._id || item?.id || item?.invoiceNumber || ''))
        : pageResult.items;
      vm.invoiceRecordsPage = pageResult.page;
      vm.invoiceRecordsHasMore = pageResult.hasMore;
      vm.invoiceRecordsTotal = pageResult.total;
      vm.invoiceRecordsLoaded = true;
      this.dashboardCache.set(cacheKey, pageResult, { ttlMs: vm.adminDashboardCacheTtlMs });
    } catch {
      if (!options.append && !silent) {
        vm.invoiceRecords = [];
        vm.invoiceRecordsPage = 1;
        vm.invoiceRecordsHasMore = false;
        vm.invoiceRecordsTotal = 0;
      }
    } finally {
      vm.invoiceRecordsLoading = false;
      vm.invoiceRecordsLoadingMore = false;
    }
  }

  private async loadAdminInvoiceClientPage(
    vm: any,
    page: number,
    options: { reset?: boolean; silent?: boolean; forceRefresh?: boolean; append?: boolean } = {},
  ): Promise<void> {
    if (!vm.dashboardCode) return;
    const cacheKey = this.adminInvoiceClientCacheKey(vm, page);
    const restored = !options.forceRefresh && this.restoreCachedInvoiceClientPage(vm, page, !!options.append);
    if (restored && !this.isRefreshDue(vm, cacheKey)) return;

    const silent = !!options.silent || restored;
    if (options.append) {
      vm.adminInvoiceClientsLoadingMore = true;
    } else {
      vm.adminInvoiceClientsLoading = !silent;
      if (options.reset && !silent) {
        vm.adminInvoiceClients = [];
        vm.adminInvoiceClientPage = 1;
        vm.adminInvoiceClientHasMore = false;
        vm.adminInvoiceClientTotal = 0;
      }
    }

    const params = new URLSearchParams({
      companyCode: vm.dashboardCode,
      search: vm.invoiceSearch.trim(),
      page: String(page),
      pageSize: String(OPERATIONAL_PAGE_SIZE),
    });

    try {
      const response = await firstValueFrom(this.api.get<any>(`/api/clients?${params.toString()}`));
      const rawClients = Array.isArray(response?.clients) ? response.clients : (response?.items || []);
      const pageResult = this.resolvePagedResponse<any>(
        response,
        rawClients.map((client: any) => this.normalizeClient(client)),
        page,
        OPERATIONAL_PAGE_SIZE,
      );
      vm.adminInvoiceClients = options.append
        ? this.mergePagedItems(vm.adminInvoiceClients, pageResult.items, (item) => String(item?.clientId || item?._id || item?.id || item?.companyName || ''))
        : pageResult.items;
      vm.adminInvoiceClientPage = pageResult.page;
      vm.adminInvoiceClientHasMore = pageResult.hasMore;
      vm.adminInvoiceClientTotal = pageResult.total;
      vm.adminInvoiceClientsLoaded = true;
      this.dashboardCache.set(cacheKey, pageResult, { ttlMs: vm.adminDashboardCacheTtlMs });
    } catch {
      if (!options.append && !silent) {
        vm.adminInvoiceClients = [];
        vm.adminInvoiceClientPage = 1;
        vm.adminInvoiceClientHasMore = false;
        vm.adminInvoiceClientTotal = 0;
      }
    } finally {
      vm.adminInvoiceClientsLoading = false;
      vm.adminInvoiceClientsLoadingMore = false;
    }
  }

  private async loadAdminQuotationClientPage(
    vm: any,
    page: number,
    options: { reset?: boolean; silent?: boolean; forceRefresh?: boolean; append?: boolean } = {},
  ): Promise<void> {
    if (!vm.dashboardCode) return;
    const cacheKey = this.adminQuotationClientCacheKey(vm, page);
    const restored = !options.forceRefresh && this.restoreCachedQuotationClientPage(vm, page, !!options.append);
    if (restored && !this.isRefreshDue(vm, cacheKey)) return;

    const silent = !!options.silent || restored;
    if (options.append) {
      vm.quotationClientsLoadingMore = true;
    } else {
      vm.adminInvoiceClientsLoading = !silent;
      if (options.reset && !silent) {
        vm.adminInvoiceClients = [];
        vm.quotationClientPage = 1;
        vm.quotationClientHasMore = false;
        vm.quotationClientTotal = 0;
      }
    }

    const params = new URLSearchParams({
      companyCode: vm.dashboardCode,
      search: vm.quotationSearch.trim(),
      page: String(page),
      pageSize: String(OPERATIONAL_PAGE_SIZE),
    });

    try {
      const response = await firstValueFrom(this.api.get<any>(`/api/clients?${params.toString()}`));
      const rawClients = Array.isArray(response?.clients) ? response.clients : (response?.items || []);
      const pageResult = this.resolvePagedResponse<any>(
        response,
        rawClients.map((client: any) => this.normalizeClient(client)),
        page,
        OPERATIONAL_PAGE_SIZE,
      );
      vm.adminInvoiceClients = options.append
        ? this.mergePagedItems(vm.adminInvoiceClients, pageResult.items, (item) => String(item?.clientId || item?._id || item?.id || item?.companyName || ''))
        : pageResult.items;
      vm.quotationClientPage = pageResult.page;
      vm.quotationClientHasMore = pageResult.hasMore;
      vm.quotationClientTotal = pageResult.total;
      vm.quotationClientsLoaded = true;
      this.dashboardCache.set(cacheKey, pageResult, { ttlMs: vm.adminDashboardCacheTtlMs });
    } catch {
      if (!options.append && !silent) {
        vm.adminInvoiceClients = [];
        vm.quotationClientPage = 1;
        vm.quotationClientHasMore = false;
        vm.quotationClientTotal = 0;
      }
    } finally {
      vm.adminInvoiceClientsLoading = false;
      vm.quotationClientsLoadingMore = false;
    }
  }

  private async loadClientOnboardingPage(
    vm: any,
    page: number,
    options: { reset?: boolean; silent?: boolean; forceRefresh?: boolean; append?: boolean } = {},
  ): Promise<void> {
    if (!vm.dashboardCode) return;
    const cacheKey = this.adminClientOnboardingCacheKey(vm, page);
    const restored = !options.forceRefresh && this.restoreCachedClientOnboardingPage(vm, page, !!options.append);
    if (restored && !this.isRefreshDue(vm, cacheKey)) return;

    const silent = !!options.silent || restored;
    if (options.reset && !silent) {
      vm.clientOnboardingRecords = [];
      vm.clientOnboardingPage = 1;
      vm.clientOnboardingHasMore = false;
      vm.clientOnboardingTotal = 0;
    }
    if (options.append) {
      vm.clientOnboardingLoadingMore = true;
    } else if (!silent) {
      vm.clientOnboardingLoading = true;
    }

    const params = new URLSearchParams({
      companyCode: vm.dashboardCode,
      search: vm.clientOnboardingSearch.trim(),
      page: String(page),
      pageSize: String(OPERATIONAL_PAGE_SIZE),
    });

    try {
      const response = await firstValueFrom(this.api.get<any>(`/api/clients?${params.toString()}`));
      const rawClients = Array.isArray(response?.clients) ? response.clients : (response?.items || []);
      const pageResult = this.resolvePagedResponse<any>(
        response,
        rawClients.map((client: any) => this.normalizeClient(client)),
        page,
        OPERATIONAL_PAGE_SIZE,
      );
      vm.clientOnboardingRecords = options.append
        ? this.mergePagedItems(vm.clientOnboardingRecords, pageResult.items, (item) => String(item?.clientId || item?._id || item?.id || item?.companyName || ''))
        : pageResult.items;
      vm.clientOnboardingPage = pageResult.page;
      vm.clientOnboardingHasMore = pageResult.hasMore;
      vm.clientOnboardingTotal = pageResult.total;
      vm.clientOnboardingLoaded = true;
      if (!vm.selectedOnboardingClientId && vm.clientOnboardingRecords.length) {
        vm.selectedOnboardingClientId = vm.clientOnboardingRecords[0].clientId;
      }
      this.dashboardCache.set(cacheKey, pageResult, { ttlMs: vm.adminDashboardCacheTtlMs });
    } catch {
      if (!options.append && !silent) {
        vm.clientOnboardingRecords = [];
        vm.clientOnboardingPage = 1;
        vm.clientOnboardingHasMore = false;
        vm.clientOnboardingTotal = 0;
      }
    } finally {
      vm.clientOnboardingLoading = false;
      vm.clientOnboardingLoadingMore = false;
    }
  }

  private async loadQuotationHistoryPage(
    vm: any,
    page: number,
    options: { reset?: boolean; silent?: boolean; forceRefresh?: boolean; append?: boolean } = {},
  ): Promise<void> {
    if (!vm.dashboardCode) return;
    const cacheKey = this.adminQuotationHistoryCacheKey(vm, page);
    const restored = !options.forceRefresh && this.restoreCachedQuotationHistoryPage(vm, page, !!options.append);
    if (restored && !this.isRefreshDue(vm, cacheKey)) return;

    const silent = !!options.silent || restored;
    if (options.reset && !silent) {
      vm.quotationRecords = [];
      vm.quotationRecordsPage = 1;
      vm.quotationRecordsHasMore = false;
      vm.quotationRecordsTotal = 0;
    }
    if (options.append) {
      vm.quotationRecordsLoadingMore = true;
    } else if (!silent) {
      vm.quotationRecordsLoading = true;
    }

    const params = new URLSearchParams({
      companyCode: vm.dashboardCode,
      search: vm.quotationHistorySearch.trim(),
      dateFrom: vm.quotationDateFrom || '',
      dateTo: vm.quotationDateTo || '',
      page: String(page),
      pageSize: String(HISTORY_PAGE_SIZE),
      paginated: 'true',
    });

    try {
      const response = await firstValueFrom(this.api.get<any>(`/api/quotations?${params.toString()}`));
      const rawItems = Array.isArray(response?.items) ? response.items : (response?.quotations || []);
      const pageResult = this.resolvePagedResponse<any>(response, rawItems, page, HISTORY_PAGE_SIZE);
      vm.quotationRecords = options.append
        ? this.mergePagedItems(vm.quotationRecords, pageResult.items, (item) => String(item?._id || item?.id || item?.quotationNumber || ''))
        : pageResult.items;
      vm.quotationRecordsPage = pageResult.page;
      vm.quotationRecordsHasMore = pageResult.hasMore;
      vm.quotationRecordsTotal = pageResult.total;
      vm.quotationRecordsLoaded = true;
      this.dashboardCache.set(cacheKey, pageResult, { ttlMs: vm.adminDashboardCacheTtlMs });
    } catch {
      if (!options.append && !silent) {
        vm.quotationRecords = [];
        vm.quotationRecordsPage = 1;
        vm.quotationRecordsHasMore = false;
        vm.quotationRecordsTotal = 0;
      }
    } finally {
      vm.quotationRecordsLoading = false;
      vm.quotationRecordsLoadingMore = false;
    }
  }

  private async loadAdminQuotationLeadPage(
    vm: any,
    page: number,
    options: { reset?: boolean; silent?: boolean; forceRefresh?: boolean; append?: boolean } = {},
  ): Promise<void> {
    if (!vm.dashboardCode) return;
    const cacheKey = this.adminQuotationLeadCacheKey(vm, page);
    const restored = !options.forceRefresh && this.restoreCachedQuotationLeadPage(vm, page, !!options.append);
    if (restored && !this.isRefreshDue(vm, cacheKey)) return;

    const silent = !!options.silent || restored;
    if (options.append) {
      vm.quotationLeadsLoadingMore = true;
    } else if (!silent) {
      vm.quotationLeadsLoading = true;
      if (options.reset) {
        vm.quotationLeads = [];
        vm.quotationLeadsPage = 1;
        vm.quotationLeadsHasMore = false;
        vm.quotationLeadsTotal = 0;
      }
    }

    try {
      const response = await firstValueFrom(this.leadService.getAdminLeadPage(vm.dashboardCode, {
        search: vm.quotationSearch.trim() || undefined,
        page,
        pageSize: OPERATIONAL_PAGE_SIZE,
        paginated: true,
      }));
      const rawItems = Array.isArray(response?.leads) ? response.leads : (response?.items || []);
      const pageResult = this.resolvePagedResponse<Lead>(
        response,
        rawItems.map((lead: any) => vm.normalizeLead(lead)),
        page,
        OPERATIONAL_PAGE_SIZE,
      );
      vm.quotationLeads = options.append
        ? this.mergePagedItems(vm.quotationLeads, pageResult.items, (item) => String(item?._id || `${item?.leadCompanyName || ''}|${item?.contactNumber || ''}`))
        : pageResult.items;
      vm.quotationLeadsPage = pageResult.page;
      vm.quotationLeadsHasMore = pageResult.hasMore;
      vm.quotationLeadsTotal = pageResult.total;
      vm.quotationLeadsLoaded = true;
      this.dashboardCache.set(cacheKey, pageResult, { ttlMs: vm.adminDashboardCacheTtlMs });
    } catch {
      if (!options.append && !silent) {
        vm.quotationLeads = [];
        vm.quotationLeadsPage = 1;
        vm.quotationLeadsHasMore = false;
        vm.quotationLeadsTotal = 0;
      }
    } finally {
      vm.quotationLeadsLoading = false;
      vm.quotationLeadsLoadingMore = false;
    }
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
        if (typeof vm.closeClientOnboardingCreateModal === 'function') {
          vm.closeClientOnboardingCreateModal();
        }
        this.fetchClientOnboardingRecords(vm, true);
        this.fetchAdminInvoiceClients(vm, true);
        this.fetchAdminQuotationClients(vm, true);
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
    return vm.quotationLeads || [];
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

  fetchQuotationRecords(vm: any, force = false): void {
    void this.loadQuotationHistoryPage(vm, 1, { reset: true, forceRefresh: force });
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
    this.refreshInvoicePreviewCaches(vm);
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
    this.refreshInvoicePreviewCaches(vm);
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
    this.refreshInvoicePreviewCaches(vm);
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
    this.refreshInvoicePreviewCaches(vm);
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
    this.refreshInvoicePreviewCaches(vm);
    vm.showInvoiceModal = true;
  }

  openAdminQuotationModalForClient(vm: any, client: any): void {
    const normalizedClient = this.normalizeClient(client);
    vm.quoteMode = true;
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
    vm.currentQuotationNumber = '';
    this.resetInvoicePublicLink(vm);
    this.refreshInvoicePreviewCaches(vm);
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
    this.refreshInvoicePreviewCaches(vm);
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
    this.refreshInvoicePreviewCaches(vm);
  }

  removeInvoiceItem(vm: any, index: number): void {
    vm.invoiceItems.splice(index, 1);
    this.refreshInvoicePreviewCaches(vm);
  }

  invoiceSubtotal(vm: any): number {
    return Number(vm.invoiceSubtotalCache || 0);
  }

  invoiceGstAmount(vm: any): number {
    return Number(vm.invoiceGstAmountCache || 0);
  }

  invoiceCgstAmount(vm: any): number {
    return Number(vm.invoiceCgstAmountCache || 0);
  }

  invoiceSgstAmount(vm: any): number {
    return Number(vm.invoiceSgstAmountCache || 0);
  }

  invoiceTotal(vm: any): number {
    return Number(vm.invoiceTotalCache || 0);
  }

  invoiceItemTaxable(vm: any, item: { price: number; quantity: number }): number {
    return Number((item as any)?.taxableAmount ?? (Number(item.price || 0) * Number(item.quantity || 1)));
  }

  invoiceItemGst(vm: any, item: { price: number; quantity: number }): number {
    return Number((item as any)?.gstAmount ?? (this.invoiceItemTaxable(vm, item) * (this.invoicePreviewGstPercentage(vm) / 100)));
  }

  invoiceItemTotal(vm: any, item: { price: number; quantity: number }): number {
    return Number((item as any)?.totalAmount ?? (this.invoiceItemTaxable(vm, item) + this.invoiceItemGst(vm, item)));
  }
  invoiceNumber(vm: any): string {
    return String(vm.invoiceNumberCache || this.resolveInvoiceNumber(vm));
  }

  invoiceCompanyDisplayName(vm: any): string {
    return String(vm.invoiceCompanyDisplayNameCache || 'DealVoice');
  }

  invoiceCompanyAddress(vm: any): string {
    return String(vm.invoiceCompanyAddressCache || '');
  }

  invoiceLogoSrc(vm: any): string {
    return String(
      vm.invoiceLogoSrcCache ||
      this.normalizeAppAssetUrl(this.activeInvoiceCompanySnapshot(vm)?.logo || vm.settingsInvoiceLogo || ''),
    );
  }

  invoiceContactLine(vm: any): string {
    return String(vm.invoiceContactLineCache || '');
  }

  quotationBankRows(vm: any): Array<{ label: string; value: string }> {
    return vm.quotationBankRowsCache || [];
  }

  quotationKindNoteText(vm: any): string {
    return String(vm.quotationKindNoteTextCache || this.defaultQuotationKindNote(vm));
  }

  formatInvoicePaymentStatus(vm: any, status?: string): string {
    return this.normalizeInvoicePaymentStatus(status || vm.invoicePaymentStatus) === 'paid' ? 'Paid' : 'Unpaid';
  }

  invoiceBankDetails(vm: any): any {
    return vm.invoiceBankDetailsCache || this.emptyBankDetails;
  }

  invoiceSealSrc(vm: any): string {
    return String(vm.invoiceSealSrcCache || '');
  }

  invoiceTermsText(vm: any): string {
    return String(vm.invoiceTermsTextCache || '');
  }

  invoicePreviewGstPercentage(vm: any): number {
    return Number(vm.invoicePreviewGstPercentageCache ?? this.resolveInvoicePreviewGstPercentage(vm));
  }

  confirmDocumentGstSelection(vm: any, useZeroGst: boolean): void {
    vm.documentGstPercentageOverride = useZeroGst ? 0 : null;
    vm.gstSelectionConfirmed = true;
    vm.showGstSelectionModal = false;
    this.refreshInvoicePreviewCaches(vm);
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
        vm.fetchInvoiceRecords(true);
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
        vm.fetchQuotationRecords(true);
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
        vm.fetchInvoiceRecords(true);
      },
      error: (err) => {
        vm.invoiceSavingLeadId = '';
        alert(err?.error?.message || 'Failed to save invoice.');
      },
    });
  }

  numberToWords(vm: any, value: number): string {
    return String(vm.invoiceAmountWordsCache || numberToWords(value));
  }

  getGstBreakdown(vm: any): any[] {
    return vm.invoiceGstBreakdownCache || [];
  }

  getTotalItemsQty(vm: any): number {
    return Number(vm.invoiceTotalItemsQtyCache || 0);
  }
}
