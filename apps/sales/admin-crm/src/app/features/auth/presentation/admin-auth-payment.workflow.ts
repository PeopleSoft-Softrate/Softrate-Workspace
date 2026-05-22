import { Injectable } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { PaymentService } from '../../../services/payment.service';
import { CrmService } from '../../../services/crm.service';

@Injectable({ providedIn: 'root' })
export class AdminAuthPaymentWorkflow {
  constructor(
    private authService: AuthService,
    private paymentService: PaymentService,
    private crmService: CrmService
  ) {}

  minToDate(vm: any): string {
    // Start from today (local)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let base = new Date(today);

    if (vm.companyProfile?.subscriptionTo) {
      // Parse subscriptionTo in LOCAL time — avoid UTC off-by-one in IST
      const raw: string = vm.companyProfile.subscriptionTo.substring(0, 10); // "YYYY-MM-DD"
      const [sY, sM, sD] = raw.split('-').map(Number);
      const subEnd = new Date(sY, sM - 1, sD, 23, 59, 59);
      if (subEnd > today) base = new Date(sY, sM - 1, sD); // keep as the sub-end day
    }

    // Minimum selectable = one day AFTER base (day after expiry, or tomorrow if expired)
    base.setDate(base.getDate() + 1);

    // Format as "YYYY-MM-DD" using LOCAL date parts (NOT toISOString which shifts to UTC)
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  subscriptionExpired(vm: any): boolean {
    if (!vm.companyProfile) return false;
    if (vm.companyProfile.status === 'On due') return true;
    if (vm.companyProfile.subscriptionTo) {
      return new Date(vm.companyProfile.subscriptionTo) < new Date();
    }
    return false;
  }

  subscriptionDaysLeft(vm: any): number | null {
    if (!vm.companyProfile?.subscriptionTo) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(vm.companyProfile.subscriptionTo);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  showDueAlert(vm: any): boolean {
    if (!vm.loggedIn || !vm.companyProfile) return false;
    const days = vm.subscriptionDaysLeft;
    if (days === null) return false;
    return days <= 7;
  }

  openTrialSignup(vm: any): void {
    vm.isTrialRequest = true;
    vm.openSignup();
  }

  openLogin(vm: any): void {
    vm.closeModals();
    vm.isLoginOpen = true;
    vm.loginError = '';
    vm.updateScrollLock();
  }

  openSignup(vm: any): void {
    vm.closeModals();
    vm.isSignupOpen = true;
    vm.signupError = '';
    vm.signupSuccess = false;
    vm.updateScrollLock();
  }

  openForgotPwd(vm: any): void {
    vm.closeModals();
    vm.isForgotPwdOpen = true;
    vm.forgotError = '';
    vm.forgotSuccess = '';
    vm.forgotEmail = '';
    vm.updateScrollLock();
  }

  openForgotFromSettings(vm: any): void {
    const email = vm.companyProfile?.email || '';
    vm.openForgotPwd();
    vm.forgotEmail = email;
  }

  onForgotPwdSubmit(vm: any, event: Event): void {
    event.preventDefault();
    if (!vm.forgotEmail) return;
    vm.forgotLoading = true;
    vm.forgotError = '';
    vm.forgotSuccess = '';

    this.authService.forgotPassword(vm.forgotEmail).subscribe({
      next: (res) => {
        vm.forgotLoading = false;
        if (res.success) {
          vm.forgotSuccess = res.message;
        } else {
          vm.forgotError = res.message;
        }
      },
      error: (err) => {
        vm.forgotLoading = false;
        vm.forgotError = err?.error?.message || 'Server error. Please try again.';
      }
    });
  }

  onResetPwdSubmit(vm: any, event: Event): void {
    event.preventDefault();
    if (!vm.isResetPasswordStrong) {
      vm.resetError = 'Password does not meet strength requirements.';
      return;
    }
    if (vm.resetNewPassword !== vm.resetConfirmPassword) {
      vm.resetError = 'Passwords do not match.';
      return;
    }

    vm.resetLoading = true;
    vm.resetError = '';
    vm.resetSuccess = '';

    this.authService.resetPassword(vm.resetTokenValue, vm.resetNewPassword).subscribe({
      next: (res) => {
        vm.resetLoading = false;
        if (res.success) {
          vm.resetSuccess = res.message;
        } else {
          vm.resetError = res.message;
        }
      },
      error: (err) => {
        vm.resetLoading = false;
        vm.resetError = err?.error?.message || 'Server error or invalid token.';
      }
    });
  }

  onPasswordInput(vm: any, value: string): void {
    vm.signupForm.password = value;
    vm.pwdChecks = {
      length: value.length >= 8,
      upper: /[A-Z]/.test(value),
      number: /[0-9]/.test(value),
      symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value),
    };
  }

  passwordStrong(vm: any): boolean { return Object.values(vm.pwdChecks).every(Boolean); }

  onSignupSubmit(vm: any, event: Event): void {
    event.preventDefault();
    vm.signupError = '';
    if (!vm.passwordStrong) { vm.signupError = 'Password does not meet strength requirements.'; return; }

    if (vm.isTrialRequest) {
      // Trial flow: create account immediately
      vm.signupLoading = true;
      this.authService.register({ ...vm.signupForm, isTrial: true }).subscribe({
        next: (res) => {
          vm.signupLoading = false;
          if (res.success) vm.signupSuccess = true;
          else vm.signupError = res.message;
        },
        error: (err) => {
          vm.signupLoading = false;
          vm.signupError = err?.error?.message || 'Something went wrong.';
        },
      });
    } else {
      // Paid flow: payment FIRST, account creation only after payment succeeds
      if (!vm.paymentToDate) { vm.signupError = 'Please select a subscription end date.'; return; }
      vm.signupLoading = true;
      vm.launchNewAccountPayment();
    }
  }

  launchNewAccountPayment(vm: any): void {
    vm.paymentStep = 'paying';
    this.paymentService.createPreOrder({
      ...vm.signupForm,
      toDate: vm.paymentToDate,
    }).subscribe({
      next: (order: any) => {
        vm.signupLoading = false;
        if (!order.success) {
          vm.signupError = 'Failed to create payment order.';
          vm.paymentStep = 'idle';
          return;
        }
        vm.openRazorpay(order, false);
      },
      error: (err: any) => {
        vm.signupLoading = false;
        vm.signupError = err?.error?.message || 'Failed to connect to payment server.';
        vm.paymentStep = 'idle';
      }
    });
  }

  openRazorpay(vm: any, order: any, isRenewal: boolean): void {
    if (order.keyId) vm.razorpayKeyId = order.keyId;
    const options = {
      key: order.keyId || vm.razorpayKeyId,
      amount: order.amount,
      currency: order.currency,
      name: 'Softrate Record',
      description: `Subscription — ${order.days} days`,
      order_id: order.orderId,
      prefill: { name: order.companyName, email: order.email, contact: order.mobile },
      theme: { color: '#6366f1' },
      handler: (response: any) => {
        if (isRenewal) {
          this.paymentService.verifyRenewal({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            companyCode: vm.dashboardCode,
          }).subscribe({
            next: (res: any) => {
              vm.renewLoading = false;
              if (res.success && vm.companyProfile) {
                vm.paymentStep = 'done';
                vm.companyProfile.subscriptionTo = res.subscriptionTo;
                vm.companyProfile.subscriptionFrom = res.subscriptionFrom;
                vm.companyProfile.status = 'Paid';
                vm.renewCostPreview = null;
                vm.renewToDate = '';
                vm.fetchPaymentHistory();
              }
            },
            error: () => { vm.renewLoading = false; vm.paymentStep = 'idle'; }
          });
        } else {
          this.paymentService.verifyNewAccount({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }).subscribe({
            next: (res: any) => {
              if (res.success) {
                vm.paymentStep = 'done';
                vm.signupSuccess = true;
              }
            },
            error: () => { vm.paymentStep = 'idle'; }
          });
        }
      },
      modal: { ondismiss: () => { vm.paymentStep = 'idle'; vm.signupLoading = false; vm.renewLoading = false; } }
    };
    const win = window as any;
    if (win.Razorpay) {
      new win.Razorpay(options).open();
    } else {
      alert('Razorpay SDK not loaded. Please refresh and try again.');
      vm.paymentStep = 'idle';
      vm.signupLoading = false;
    }
  }

  renewSubscription(vm: any): void {
    if (!vm.renewToDate || !vm.dashboardCode) return;
    vm.renewLoading = true;
    this.paymentService.createRenewalOrder(vm.dashboardCode, vm.renewToDate).subscribe({
      next: (order: any) => {
        if (!order.success) { vm.renewLoading = false; return; }
        vm.openRazorpay(order, true);
      },
      error: () => { vm.renewLoading = false; }
    });
  }

  onRenewToDateChange(vm: any): void {
    if (!vm.renewToDate || !vm.companyProfile?.teamSize) {
      vm.renewCostPreview = null;
      return;
    }

    // Today at midnight (local time) — used as the "start" when subscription has expired
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let from: Date;

    if (vm.companyProfile?.subscriptionTo) {
      // Parse subscriptionTo in LOCAL time to avoid UTC off-by-one in IST
      const [sY, sM, sD] = vm.companyProfile.subscriptionTo.substring(0, 10).split('-').map(Number);
      const subEnd = new Date(sY, sM - 1, sD, 23, 59, 59, 999);

      if (subEnd >= today) {
        // Subscription still active → start from the day AFTER it ends
        from = new Date(sY, sM - 1, sD + 1, 0, 0, 0, 0);
      } else {
        // Subscription already expired → start from today
        from = today;
      }
    } else {
      // No subscription at all → start from today
      from = today;
    }

    // Parse the user-selected end date in LOCAL time
    const [toY, toM, toD] = vm.renewToDate.split('-').map(Number);
    const to = new Date(toY, toM - 1, toD, 23, 59, 59, 999);
    const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

    const teamSizeVal = parseInt(vm.companyProfile.teamSize.toString(), 10);
    const teamSizeMax = isNaN(teamSizeVal) ? 10 : teamSizeVal;

    const subtotal = teamSizeMax * 10 * days;
    const tax = subtotal * 0.18;
    vm.renewCostPreview = { days, teamSizeMax, amountRupees: parseFloat((subtotal + tax).toFixed(2)) };
  }

  onToDateChange(vm: any): void {
    if (!vm.paymentToDate || !vm.signupForm.teamSize) {
      vm.paymentCostPreview = null;
      return;
    }
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    // Parse the date string in LOCAL time to avoid UTC off-by-one in IST (and other UTC+ zones).
    const [toY, toM, toD] = vm.paymentToDate.split('-').map(Number);
    const to = new Date(toY, toM - 1, toD, 23, 59, 59, 999);
    const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

    // teamSize is now a direct number input, fallback to 10 if invalid
    const teamSizeVal = parseInt(vm.signupForm.teamSize.toString(), 10);
    const teamSizeMax = isNaN(teamSizeVal) ? 10 : teamSizeVal;

    const subtotal = teamSizeMax * 10 * days;
    const tax = subtotal * 0.18;
    vm.paymentCostPreview = { days, teamSizeMax, amountRupees: parseFloat((subtotal + tax).toFixed(2)) };
  }

  fetchPaymentHistory(vm: any): void {
    if (!vm.dashboardCode) return;
    vm.paymentHistoryLoading = true;
    this.paymentService.getHistory(vm.dashboardCode).subscribe({
      next: (res) => {
        vm.paymentHistoryLoading = false;
        if (res.success) {
          vm.paymentHistory = res.payments;
          if ((res as any).keyId) vm.razorpayKeyId = (res as any).keyId;
        }
      },
      error: () => { vm.paymentHistoryLoading = false; }
    });
  }

  deleteOrder(vm: any, id: string): void {
    if (!confirm('Are you sure you want to delete this unpaid order?')) return;
    this.paymentService.deleteOrder(id).subscribe({
      next: (res) => {
        if (res.success) vm.fetchPaymentHistory();
        else alert(res.message || 'Failed to delete order.');
      },
      error: (err) => alert(err?.error?.message || 'Server error.')
    });
  }

  retryPayment(vm: any, p: any): void {
    const orderData = {
      orderId: p.razorpayOrderId,
      amount: p.amount,
      currency: 'INR',
      days: p.days,
      companyName: vm.companyProfile?.companyName,
      email: vm.companyProfile?.email,
      mobile: vm.companyProfile?.mobile,
      keyId: vm.razorpayKeyId
    };
    vm.openRazorpay(orderData, true);
  }

  downloadInvoice(vm: any, p: any): void {
    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow popups to view the invoice.');
      return;
    }

    const amountRupees = p.amount / 100;
    const days = p.days || 30; // fallback if missing
    const ratePerDay = p.paymentRatePerDay || 10; // fallback if missing

    // Fallback company info if profile is not fully loaded
    const companyName = vm.companyProfile?.companyName || 'Valued Customer';
    const companyEmail = vm.companyProfile?.email || '';
    const companyAddress = vm.companyProfile?.companyAddress || 'No address provided';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice - ${p.razorpayOrderId}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 0; }
          body { 
            font-family: 'Inter', system-ui, sans-serif; 
            margin: 0; 
            padding: 0;
            background: #fff;
            color: #1a1a1a;
            -webkit-print-color-adjust: exact;
          }
          .a4-container {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 30mm 20mm;
            box-sizing: border-box;
          }
          .header {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 50px;
          }
          .logo {
            height: 48px;
            margin-bottom: 24px;
          }
          .seller-info {
            text-align: center;
            color: #666;
            font-size: 13px;
            line-height: 1.5;
          }
          .invoice-grid {
            display: grid;
            grid-template-columns: 100px 1fr;
            gap: 40px;
            margin-bottom: 60px;
            font-size: 14px;
          }
          .grid-label {
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #000;
          }
          .grid-content {
            line-height: 1.6;
          }
          .client-name {
            font-weight: 700;
            margin-bottom: 4px;
            font-size: 15px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 40px;
            margin-bottom: 30px;
          }
          th {
            text-align: left;
            padding: 12px 10px;
            border-bottom: 1px solid #eee;
            text-transform: uppercase;
            font-size: 12px;
            color: #666;
            letter-spacing: 0.05em;
          }
          td {
            padding: 20px 10px;
            border-bottom: 1px solid #f9f9f9;
            font-size: 14px;
            vertical-align: top;
          }
          .item-desc {
            font-weight: 600;
            margin-bottom: 4px;
            font-size: 14px;
          }
          .item-subtext {
            color: #666;
            font-size: 12px;
            display: block;
          }
          .summary-container {
            border-top: 2px solid #000;
            padding-top: 30px;
            display: flex;
            justify-content: space-between;
          }
          .summary-item {
            display: flex;
            flex-direction: column;
            gap: 15px;
          }
          .summary-label {
            font-weight: 700;
            text-transform: uppercase;
            font-size: 13px;
            letter-spacing: 0.05em;
          }
          .summary-val {
            font-weight: 400;
            font-size: 14px;
          }
          .grand-total {
            font-size: 32px;
            font-weight: 700;
            color: #000;
          }
          .notes {
            margin-top: 80px;
            padding-top: 20px;
            font-size: 12px;
            color: #666;
            line-height: 1.6;
          }
          .footer-brand {
            margin-top: 10px;
            font-weight: 700;
            font-size: 14px;
            color: #000;
          }
          @media print {
            body { background: none; }
            .a4-container { margin: 0; padding: 25mm 15mm; }
          }
        </style>
      </head>
      <body>
        <div class="a4-container">
          <div class="header">
            <img class="logo" src="/assets/icon/logo.png" alt="DealVoice">
            <div class="seller-info">
              Softrate Technologies Private Limited<br>
              dealvoice.co | support@softrate.com | GSTN: 33ABKCS4479F1Z2
            </div>
          </div>

          <div class="invoice-grid">
            <div class="grid-label">Invoice</div>
            <div class="grid-content">
              ${new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}<br>
              Order #${p.razorpayOrderId}
            </div>

            <div class="grid-label">Client</div>
            <div class="grid-content">
              <div class="client-name">${companyName}</div>
              Company Email: ${companyEmail}<br>
              ${companyAddress}
            </div>

            <div class="grid-label">Transaction</div>
            <div class="grid-content">
              Payment ID: <strong>${p.razorpayPaymentId || 'N/A'}</strong><br>
              Method: <strong>Secured via Razorpay</strong><br>
              Date: <strong>${new Date(p.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 45%;">Description</th>
                <th style="width: 15%;">Days</th>
                <th style="width: 20%;">Rate / Day</th>
                <th style="width: 20%; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div class="item-desc">Subscription - DealVoice Business</div>
                  <span class="item-subtext">Subscription Period: ${new Date(p.fromDate).toLocaleDateString()} to ${new Date(p.toDate).toLocaleDateString()}</span>
                  <span class="item-subtext">Total User Capacity: ${p.teamSizeMax} Users</span>
                </td>
                <td>${days}</td>
                <td>₹${ratePerDay.toLocaleString()}</td>
                <td style="text-align: right; font-weight: 600;">₹${((p.subtotal || (p.amount / 1.18)) / 100).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div class="summary-container">
            <div class="summary-item">
              <div class="summary-label">Subtotal</div>
              <div class="summary-val">₹${((p.subtotal || (p.amount / 1.18)) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Tax (18% GST)</div>
              <div class="summary-val">₹${((p.tax || (p.amount - (p.amount / 1.18))) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="summary-item" style="align-items: flex-end;">
              <div class="summary-label">Total Amount</div>
              <div class="grand-total">₹${(p.amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div class="notes">
            Please note that this is a system-generated invoice. For any queries regarding this payment or your subscription, feel free to reach out to our support team.
            Thank you for your confidence in DealVoice.
          </div>

          <div class="footer-brand">
            Softrate Technologies Private Limited.
          </div>
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
              setTimeout(() => window.close(), 500);
            }, 1000);
          };
        </script>
      </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
  }

  onLoginSubmit(vm: any, event: Event): void {
    event.preventDefault();
    vm.loginError = '';
    vm.loginLoading = true;

    this.authService.login(vm.loginForm).subscribe({
      next: (res) => {
        vm.loginLoading = false;
        if (res.success && res.user) {
          const adminUser = { ...res.user, role: 'admin' };
          vm.closeModals();
          vm.loggedIn = true;
          vm.userRole = 'admin';
          vm.dashTab = 'overview';
          vm.dashboardCompany = res.user.companyName || 'Your Company';
          vm.dashboardCode = res.user.companyCode || 'N/A';
          vm.dashboardTeamSize = parseInt(res.user.teamSize) || 0;
          vm.crmActionMessage = '';
          vm.selectedCrmClientCompany = '';
          vm.loadAdminProfilePhoto?.();
          localStorage.removeItem('tracecall_crm_token');
          localStorage.setItem('tracecall_user', JSON.stringify(adminUser));
          setTimeout(() => window.scrollTo(0, 0), 0);
          vm._loadDashboard();
        } else {
          vm.loginError = res.message;
        }
      },
      error: (err) => {
        // Handle pending approval status
        if (err.status === 403) {
          vm.loginLoading = false;
          vm.loginError = err.error?.message || 'Account pending approval.';
        } else {
          this.loginAsCrmAdmin(vm, err?.error?.message);
        }
      },
    });
  }

  private loginAsCrmAdmin(vm: any, adminErrorMessage = ''): void {
    this.crmService.login(vm.loginForm).subscribe({
      next: (res) => {
        vm.loginLoading = false;
        if (res.success && res.user && res.token) {
          const crmCompanyName = String(res.user.companyName || '').trim().toLowerCase();
          const configuredCompanyCode = res.user.salesCompanyCode || res.user.adminCompanyCode || res.user.companyCode || '';
          const salesCompanyCode = crmCompanyName.includes('softrate tech park') || !configuredCompanyCode
            ? 'STP-1603-2026'
            : configuredCompanyCode;
          const crmUser = {
            ...res.user,
            role: 'crm_admin',
            crmCompanyCode: res.user.crmCompanyCode || res.user.companyCode || '',
            salesCompanyCode,
            companyCode: salesCompanyCode,
          };
          vm.closeModals();
          vm.loggedIn = true;
          vm.userRole = 'crm_admin';
          vm.dashboardCompany = res.user.companyName || 'Softrate CRM';
          vm.dashboardCode = salesCompanyCode;
          vm.dashboardTeamSize = parseInt(res.user.teamSize || '0', 10) || 0;
          vm.dashTab = 'crm_clients';
          localStorage.setItem('tracecall_user', JSON.stringify(crmUser));
          localStorage.setItem('tracecall_crm_token', res.token);
          setTimeout(() => window.scrollTo(0, 0), 0);
          vm.loadCrmDashboard();
          if (vm.dashboardCode) vm._loadDashboard();
        } else {
          vm.loginError = adminErrorMessage || res.message || 'Invalid credentials or server error.';
        }
      },
      error: (err) => {
        vm.loginLoading = false;
        vm.loginError = adminErrorMessage || err?.error?.message || 'Invalid credentials or server error.';
      },
    });
  }

  goToLoginFromSuccess(vm: any): void { vm.openLogin(); vm.signupSuccess = false; }

  openLogoutConfirm(vm: any): void {
    vm.isLogoutConfirmOpen = true;
    vm.updateScrollLock();
  }

  closeLogoutConfirm(vm: any): void {
    vm.isLogoutConfirmOpen = false;
  }

  logout(vm: any): void {
    vm.loggedIn = false;
    vm.userRole = 'admin';
    vm.dashTab = 'overview';
    vm.dashboardCompany = '';
    vm.dashboardCode = '';
    vm.adminProfilePhoto = '';
    vm.profileMenuOpen = false;
    vm.employees = [];
    vm.summaryStats = null;
    vm.selectedEmployee = null;
    vm.selectedCrmClientCompany = '';
    vm.crmActionMessage = '';
    vm.isLogoutConfirmOpen = false;
    if (vm.timelineChart) { vm.timelineChart.destroy(); vm.timelineChart = null; }
    if (vm.donutChart) { vm.donutChart.destroy(); vm.donutChart = null; }
    localStorage.removeItem('tracecall_user');
    localStorage.removeItem('tracecall_crm_token');
    window.scrollTo(0, 0);
  }

}
