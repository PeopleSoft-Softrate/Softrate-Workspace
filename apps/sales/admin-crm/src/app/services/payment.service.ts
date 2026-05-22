import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PaymentCalculation {
  success: boolean;
  fromDate: string;
  toDate: string;
  days: number;
  teamSize: string;
  teamSizeMax: number;
  pricePerPersonPerDay: number;
  amountRupees: number;
  amountPaise: number;
}

export interface OrderResponse {
  success: boolean;
  orderId: string;
  amount: number;
  amountRupees: number;
  currency: string;
  days: number;
  teamSizeMax: number;
  fromDate: string;
  toDate: string;
  keyId: string;
  companyName: string;
  email: string;
  mobile: string;
}

export interface PaymentRecord {
  _id: string;
  companyCode: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number;
  fromDate: string;
  toDate: string;
  teamSizeMax: number;
  days: number;
  status: 'created' | 'paid' | 'failed';
  paymentMethod?: string;
  bank?: string;
  bankTransactionId?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  constructor(private api: ApiService) {}

  /** Preview cost without creating any order */
  calculate(teamSize: string, toDate: string, companyCode?: string): Observable<PaymentCalculation> {
    let url = `/api/payment/calculate?teamSize=${encodeURIComponent(teamSize)}&toDate=${encodeURIComponent(toDate)}`;
    if (companyCode) url += `&companyCode=${encodeURIComponent(companyCode)}`;
    return this.api.get<PaymentCalculation>(url);
  }

  /**
   * PAYMENT-FIRST: Creates order WITHOUT creating account yet.
   * Stores hashed signup data in pendingSignup until payment verified.
   */
  createPreOrder(signupData: {
    companyName: string; companyAddress?: string; name: string;
    email: string; password: string; countryCode: string;
    mobile: string; teamSize: string; industry: string; toDate: string;
  }): Observable<OrderResponse> {
    return this.api.post<OrderResponse>('/api/payment/pre-order', signupData);
  }

  /**
   * Verify payment → creates account → returns companyCode + full payment details
   */
  verifyNewAccount(payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Observable<any> {
    return this.api.post('/api/payment/verify', payload);
  }

  /** Renewal order for existing logged-in users */
  createRenewalOrder(companyCode: string, toDate: string): Observable<OrderResponse> {
    return this.api.post<OrderResponse>('/api/payment/renew', { companyCode, toDate });
  }

  /** Verify renewal payment → extends subscription */
  verifyRenewal(payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    companyCode: string;
  }): Observable<any> {
    return this.api.post('/api/payment/verify-renewal', payload);
  }

  getHistory(companyCode: string): Observable<{ success: boolean; payments: PaymentRecord[] }> {
    return this.api.get<{ success: boolean; payments: PaymentRecord[] }>(`/api/payment/history/${encodeURIComponent(companyCode)}`);
  }

  deleteOrder(id: string): Observable<any> {
    return this.api.delete(`/api/payment/order/${id}`);
  }
}
