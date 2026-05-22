import { Injectable } from '@angular/core';
import { ApiService } from '../../../services/api.service';
import { Lead } from '../../../services/lead.service';
import { formatInvoiceMoney as formatInvoiceMoneyValue } from '../domain/invoice-formatters';

@Injectable({ providedIn: 'root' })
export class AdminInvoiceQuotationWorkflow {
  constructor(private api: ApiService) {}

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
    vm.currentInvoiceNumber = record.invoiceNumber || '';
    vm.invoiceLead = {
      _id: record.leadId || '',
      companyCode: vm.dashboardCode,
      assignedEmployeePhone: record.employeePhone || '',
      leadCompanyName: record.leadCompanyName || '',
      contactName: record.contactName || '',
      contactNumber: record.contactNumber || '',
      directorEmailAddress: record.directorEmailAddress || '',
      status: '',
    };
    vm.invoiceIssuedAt = record.invoiceDate ? new Date(record.invoiceDate) : new Date(record.createdAt || Date.now());
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
    vm.currentQuotationNumber = record.quotationNumber || '';
    vm.invoiceLead = {
      _id: record.leadId || '',
      companyCode: vm.dashboardCode,
      assignedEmployeePhone: record.employeePhone || '',
      leadCompanyName: record.leadCompanyName || '',
      contactName: record.contactName || '',
      contactNumber: record.contactNumber || '',
      directorEmailAddress: record.directorEmailAddress || '',
      status: '',
    };
    vm.invoiceIssuedAt = record.quotationDate ? new Date(record.quotationDate) : new Date(record.createdAt || Date.now());
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

  openQuotationModal(vm: any, lead: Lead): void {
    vm.quoteMode = true;
    vm.viewingSavedDocument = false;
    vm.invoiceLead = lead;
    vm.invoiceItems = [];
    vm.selectedInvoiceProduct = null;
    vm.invoicePrice = 0;
    vm.invoiceQuantity = 1;
    vm.invoiceIssuedAt = new Date();
    vm.quoteNumber = Math.floor(100000 + Math.random() * 900000);
    vm.currentQuotationNumber = '';
    vm.showInvoiceModal = true;
  }

  openAdminInvoiceModal(vm: any, lead: Lead): void {
    vm.quoteMode = false;
    vm.viewingSavedDocument = false;
    vm.invoiceLead = lead;
    vm.invoiceItems = [];
    vm.selectedInvoiceProduct = null;
    vm.invoicePrice = 0;
    vm.invoiceQuantity = 1;
    vm.invoiceIssuedAt = new Date();
    vm.quoteNumber = Math.floor(100000 + Math.random() * 900000);
    vm.currentInvoiceNumber = '';
    vm.showInvoiceModal = true;
  }

  closeInvoiceModal(vm: any): void {
    vm.showInvoiceModal = false;
    vm.quoteMode = false;
    vm.viewingSavedDocument = false;
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
    return vm.invoiceSubtotal * (Number(vm.settingsGstPercentage || 0) / 100);
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
    return this.invoiceItemTaxable(vm, item) * (Number(vm.settingsGstPercentage || 0) / 100);
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
    return (vm.settingsShowCompanyNameOnInvoice ? (vm.settingsCompanyName || vm.dashboardCompany) : '') || 'DealVoice';
  }

  invoiceCompanyAddress(vm: any): string {
    return vm.settingsInvoiceRegisteredAddress || vm.companyProfile?.companyAddress || '';
  }

  printInvoice(vm: any): void {
    if (vm.invoiceItems.length === 0) {
      alert(`Please add at least one product to the ${vm.quoteMode ? 'quotation' : 'invoice'}.`);
      return;
    }
    if (vm.viewingSavedDocument) {
      setTimeout(() => window.print(), 50);
      return;
    }
    if (vm.quoteMode) {
      vm.saveAndPrintQuotation();
      return;
    }
    if (!vm.invoiceLead || vm.invoiceSaving) return;

    vm.invoiceSaving = true;
    this.api.post<any>('/api/invoices', {
      companyCode: vm.dashboardCode,
      employeePhone: vm.invoiceLead.assignedEmployeePhone,
      employeeName: vm.getEmployeeName(vm.invoiceLead.assignedEmployeePhone),
      createdByRole: 'admin',
      createdByName: vm.dashboardCompany,
      leadId: vm.invoiceLead._id,
      contactNumber: vm.invoiceLead.contactNumber,
      gstPercentage: vm.settingsGstPercentage,
      invoiceDate: vm.invoiceIssuedAt,
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
        setTimeout(() => window.print(), 50);
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
      gstPercentage: vm.settingsGstPercentage,
      quotationDate: vm.invoiceIssuedAt,
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
        vm.fetchQuotationRecords();
        setTimeout(() => window.print(), 50);
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

}
