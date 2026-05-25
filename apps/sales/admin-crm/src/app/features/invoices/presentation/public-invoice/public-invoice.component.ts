import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import QRCode from 'qrcode';
import { ApiService } from '../../../../services/api.service';
import { formatInvoiceMoney } from '../../domain/invoice-formatters';

interface PublicInvoiceItem {
  name?: string;
  sacHsn?: string;
  quantity?: number;
  rate?: number;
  taxable?: number;
  cgst?: number;
  sgst?: number;
  total?: number;
}

interface InvoiceCompanySnapshot {
  name?: string;
  logo?: string;
  gstNumber?: string;
  registeredAddress?: string;
  phone?: string;
  email?: string;
  website?: string;
  footer?: string;
}

interface InvoiceClientSnapshot {
  companyName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface PublicInvoice {
  invoiceNumber?: string;
  publicUrl?: string;
  leadCompanyName?: string;
  contactName?: string;
  contactNumber?: string;
  directorEmailAddress?: string;
  items?: PublicInvoiceItem[];
  subtotal?: number;
  gstPercentage?: number;
  cgst?: number;
  sgst?: number;
  gstAmount?: number;
  total?: number;
  invoiceDate?: string;
  dueDate?: string | null;
  paymentStatus?: string;
  createdByName?: string;
  employeeName?: string;
  companySnapshot?: InvoiceCompanySnapshot;
  clientSnapshot?: InvoiceClientSnapshot;
}

@Component({
  selector: 'app-public-invoice',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-invoice.component.html',
  styleUrl: './public-invoice.component.css',
})
export class PublicInvoiceComponent implements OnInit {
  invoice: PublicInvoice | null = null;
  loading = true;
  error = '';
  qrDataUrl = '';

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
  ) {}

  ngOnInit(): void {
    const publicToken = this.route.snapshot.paramMap.get('publicToken') || '';
    if (!publicToken) {
      this.loading = false;
      this.error = 'Invoice not found.';
      return;
    }

    this.api.get<{ success: boolean; invoice?: PublicInvoice; message?: string }>(`/api/invoices/public/${encodeURIComponent(publicToken)}`).subscribe({
      next: (res) => {
        this.loading = false;
        if (!res?.success || !res.invoice) {
          this.error = res?.message || 'Invoice not found.';
          return;
        }
        this.invoice = res.invoice;
        this.generateQr(res.invoice.publicUrl || window.location.href);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Invoice not found.';
      },
    });
  }

  private generateQr(url: string): void {
    if (!url) return;
    QRCode.toDataURL(url, {
      width: 136,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    }).then((dataUrl) => {
      this.qrDataUrl = dataUrl;
    }).catch(() => {
      this.qrDataUrl = '';
    });
  }

  companyName(invoice: PublicInvoice): string {
    return invoice.companySnapshot?.name || 'Softrate';
  }

  companyAddress(invoice: PublicInvoice): string {
    return invoice.companySnapshot?.registeredAddress || '';
  }

  clientCompany(invoice: PublicInvoice): string {
    return invoice.clientSnapshot?.companyName || invoice.leadCompanyName || 'Client Company';
  }

  clientContact(invoice: PublicInvoice): string {
    return invoice.clientSnapshot?.contactName || invoice.contactName || '';
  }

  clientPhone(invoice: PublicInvoice): string {
    return invoice.clientSnapshot?.phone || invoice.contactNumber || '';
  }

  clientEmail(invoice: PublicInvoice): string {
    return invoice.clientSnapshot?.email || invoice.directorEmailAddress || '';
  }

  billedBy(invoice: PublicInvoice): string {
    return invoice.createdByName || invoice.employeeName || 'Softrate';
  }

  statusLabel(invoice: PublicInvoice): string {
    return String(invoice.paymentStatus || 'unpaid').toLowerCase() === 'paid' ? 'Paid' : 'Unpaid';
  }

  statusClass(invoice: PublicInvoice): string {
    return this.statusLabel(invoice).toLowerCase();
  }

  items(invoice: PublicInvoice): PublicInvoiceItem[] {
    return Array.isArray(invoice.items) ? invoice.items : [];
  }

  itemTaxable(item: PublicInvoiceItem): number {
    if (item.taxable !== undefined && item.taxable !== null) return Number(item.taxable || 0);
    return Number(item.rate || 0) * Number(item.quantity || 1);
  }

  itemCgst(item: PublicInvoiceItem): number {
    return Number(item.cgst || 0);
  }

  itemSgst(item: PublicInvoiceItem): number {
    return Number(item.sgst || 0);
  }

  itemTotal(item: PublicInvoiceItem): number {
    if (item.total !== undefined && item.total !== null) return Number(item.total || 0);
    return this.itemTaxable(item) + this.itemCgst(item) + this.itemSgst(item);
  }

  formatMoney(value?: number): string {
    return formatInvoiceMoney(Number(value || 0));
  }

  trackByItem(index: number): number {
    return index;
  }

  printPage(): void {
    window.print();
  }
}
