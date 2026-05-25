import { Injectable } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { formatSeconds } from '../../reports/domain/call-formatters';

const DEFAULT_INVOICE_LOGO = '/assets/icon/softrate-transparent-logo.png';

@Injectable({ providedIn: 'root' })
export class AdminSettingsWorkflow {
  constructor(private authService: AuthService) {}

  canRequestRm(vm: any): boolean {
    if (!vm.companyProfile) return false;
    if (!vm.companyProfile.rmRequestTime) return true;
    const hoursSinceRequest = (Date.now() - new Date(vm.companyProfile.rmRequestTime).getTime()) / (1000 * 60 * 60);
    return hoursSinceRequest >= 8;
  }

  fetchCompanyProfile(vm: any): void {
    if (!vm.dashboardCode) return;
    vm.companyProfileLoading = true;
    this.authService.getCompanyProfile(vm.dashboardCode).subscribe({
      next: (res: any) => {
        vm.companyProfileLoading = false;
        if (res.success) {
          vm.companyProfile = res.company;
          vm.editAddressValue = res.company.companyAddress || '';
          vm.tagOptions = res.company.tags || [];
          if (vm.companyProfile.rmRequestTime) {
            vm.startRmTimer(vm.companyProfile.rmRequestTime);
          }
        }
      },
      error: () => { vm.companyProfileLoading = false; },
    });
  }

  requestRm(vm: any): void {
    if (!vm.dashboardCode) return;
    vm.rmRequestLoading = true;
    vm.rmRequestMessage = '';

    this.authService.requestRm(vm.dashboardCode).subscribe({
      next: (res: any) => {
        vm.rmRequestLoading = false;
        if (res.success) {
          vm.rmRequestMessage = res.message;
          if (vm.companyProfile) {
            vm.companyProfile.rmRequestTime = res.rmRequestTime;
            vm.startRmTimer(res.rmRequestTime);
          }
        }
      },
      error: (err: any) => {
        vm.rmRequestLoading = false;
        vm.rmRequestMessage = err?.error?.message || 'Error sending request.';
      },
    });
  }

  startRmTimer(vm: any, requestTime: any): void {
    if (vm.rmTimerInterval) clearInterval(vm.rmTimerInterval);

    const update = () => {
      const start = new Date(requestTime).getTime();
      const end = start + (8 * 60 * 60 * 1000);
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        vm.rmCountdown = '';
        clearInterval(vm.rmTimerInterval);
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      vm.rmCountdown = `${h}h ${m}m ${s}s`;
    };

    update();
    vm.rmTimerInterval = setInterval(update, 1000);
  }

  assignAdminRm(vm: any): void {
    if (!vm.dashboardCode) return;
    vm.adminRmLoading = true;

    this.authService.assignRm(vm.dashboardCode, vm.adminRm).subscribe({
      next: (res: any) => {
        vm.adminRmLoading = false;
        if (res.success) {
          if (vm.companyProfile) {
            vm.companyProfile.relationshipManager = res.company.relationshipManager;
          }
          alert('RM Assigned successfully!');
        }
      },
      error: () => {
        vm.adminRmLoading = false;
        alert('Failed to assign RM.');
      },
    });
  }

  copyConnectCodeLink(vm: any): void {
    const link = 'https://help.callyzer.co/article/how-to-register-your-emp/';
    navigator.clipboard.writeText(link).then(() => {
      alert('Link copied to clipboard!');
    }).catch((err) => {
      console.error('Could not copy text: ', err);
    });
  }

  addTag(vm: any): void {
    const tag = vm.newTagInput.trim();
    if (!tag) return;
    if (vm.tagOptions.includes(tag)) {
      vm.tagManagementError = 'Tag already exists.';
      setTimeout(() => vm.tagManagementError = '', 3000);
      return;
    }
    vm.tagOptions.push(tag);
    vm.newTagInput = '';
    vm.persistCompanyTags();
  }

  removeTag(vm: any, tag: string): void {
    vm.tagOptions = vm.tagOptions.filter((item: string) => item !== tag);
    vm.persistCompanyTags();
  }

  persistCompanyTags(vm: any): void {
    if (!vm.dashboardCode) return;
    vm.tagManagementLoading = true;
    vm.tagManagementError = '';

    this.authService.updateCompanyTags(vm.dashboardCode, vm.tagOptions).subscribe({
      next: (res: any) => {
        vm.tagManagementLoading = false;
        if (res.success) {
          vm.tagOptions = res.tags;
          if (vm.companyProfile) vm.companyProfile.tags = res.tags;
          vm.tagManagementSuccess = 'Tags updated!';
          setTimeout(() => vm.tagManagementSuccess = '', 3000);
        } else {
          vm.tagManagementError = res.message;
        }
      },
      error: (err: any) => {
        vm.tagManagementLoading = false;
        vm.tagManagementError = err?.error?.message || 'Error updating tags.';
      },
    });
  }

  fetchSettings(vm: any): void {
    if (!vm.dashboardCode) return;
    vm.settingsLoading = true;
    this.authService.getCompanySettings(vm.dashboardCode).subscribe({
      next: (res: any) => {
        vm.settingsLoading = false;
        if (res.success) {
          vm.settingsBreakHourLimit = res.settings.breakHourLimit ?? 60;
          vm.settingsConnectedCallDuration = res.settings.connectedCallDuration ?? 0;
          vm.settingsLeadStatuses = res.settings.leadStatuses || [];
          vm.settingsInterestedPageStatuses = res.settings.interestedPageStatuses || [];
          vm.settingsDnpPageStatuses = res.settings.dnpPageStatuses || [];
          vm.settingsConvertedPageStatuses = res.settings.convertedPageStatuses || [];
          vm.settingsCompanyName = res.settings.companyName || '';
          vm.settingsInvoiceLogo = res.settings.invoiceLogo || DEFAULT_INVOICE_LOGO;
          vm.settingsInvoiceSeal = res.settings.invoiceSeal || '';
          vm.settingsInvoiceTerms = res.settings.invoiceTerms || '';
          vm.settingsShowCompanyNameOnInvoice = res.settings.showCompanyNameOnInvoice ?? true;
          vm.settingsGstNumber = res.settings.gstNumber || '';
          vm.settingsGstPercentage = res.settings.gstPercentage ?? 18;
          vm.settingsInvoiceRegisteredAddress = res.settings.invoiceRegisteredAddress || '';
          vm.settingsInvoiceFooter = res.settings.invoiceFooter || '';
          vm.settingsBankDetails = res.settings.bankDetails || { bankName: '', accountNumber: '', ifscCode: '', branchName: '' };
          vm.settingsContactDetails = res.settings.contactDetails || { website: '', email: '', phone: '' };
          vm.settingsProducts = res.settings.products || [];
          vm.settingsProductRemarks = res.settings.productRemarks || [];
        }
      },
      error: () => { vm.settingsLoading = false; },
    });
  }

  onLogoUpload(vm: any, event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        vm.settingsSaveError = 'Logo size must be under 3MB.';
        return;
      }
      const reader = new FileReader();
      reader.onload = (e: any) => {
        vm.settingsInvoiceLogo = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  onSealUpload(vm: any, event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        vm.settingsSaveError = 'Seal size must be under 3MB.';
        return;
      }
      const reader = new FileReader();
      reader.onload = (e: any) => {
        vm.settingsInvoiceSeal = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  addProduct(vm: any): void {
    if (!vm.newProductInput.name || vm.newProductInput.minPrice < 0 || vm.newProductInput.maxPrice < vm.newProductInput.minPrice) {
      return;
    }
    vm.settingsProducts.push({
      ...vm.newProductInput,
      tags: Array.isArray(vm.newProductInput.tags) ? [...vm.newProductInput.tags] : [],
    });
    vm.newProductInput = { name: '', minPrice: 0, maxPrice: 0, tags: [] };
  }

  toggleNewProductTag(vm: any, tag: string): void {
    if (!Array.isArray(vm.newProductInput.tags)) vm.newProductInput.tags = [];
    const index = vm.newProductInput.tags.indexOf(tag);
    if (index >= 0) vm.newProductInput.tags.splice(index, 1);
    else vm.newProductInput.tags.push(tag);
  }

  toggleProductTag(vm: any, product: any, tag: string): void {
    if (!Array.isArray(product.tags)) product.tags = [];
    const index = product.tags.indexOf(tag);
    if (index >= 0) product.tags.splice(index, 1);
    else product.tags.push(tag);
  }

  addProductRemark(vm: any): void {
    const val = vm.newProductRemarkInput.trim();
    if (val && !vm.settingsProductRemarks.includes(val)) {
      vm.settingsProductRemarks.push(val);
      vm.newProductRemarkInput = '';
    }
  }

  removeProductRemark(vm: any, remark: string): void {
    vm.settingsProductRemarks = vm.settingsProductRemarks.filter((item: string) => item !== remark);
  }

  removeProduct(vm: any, index: number): void {
    vm.settingsProducts.splice(index, 1);
  }

  saveSettings(vm: any): void {
    if (!vm.dashboardCode) return;
    vm.settingsLoading = true;
    vm.settingsSaveError = '';
    vm.settingsSaveSuccess = '';

    this.authService.updateCompanySettings(vm.dashboardCode, {
      companyName: vm.settingsCompanyName,
      breakHourLimit: vm.settingsBreakHourLimit,
      connectedCallDuration: vm.settingsConnectedCallDuration,
      leadStatuses: vm.settingsLeadStatuses,
      interestedPageStatuses: vm.settingsInterestedPageStatuses,
      dnpPageStatuses: vm.settingsDnpPageStatuses,
      convertedPageStatuses: vm.settingsConvertedPageStatuses,
      invoiceLogo: vm.settingsInvoiceLogo,
      invoiceSeal: vm.settingsInvoiceSeal,
      invoiceTerms: vm.settingsInvoiceTerms,
      showCompanyNameOnInvoice: vm.settingsShowCompanyNameOnInvoice,
      gstNumber: vm.settingsGstNumber,
      gstPercentage: vm.settingsGstPercentage,
      invoiceRegisteredAddress: vm.settingsInvoiceRegisteredAddress,
      invoiceFooter: vm.settingsInvoiceFooter,
      bankDetails: vm.settingsBankDetails,
      contactDetails: vm.settingsContactDetails,
      products: vm.settingsProducts,
      productRemarks: vm.settingsProductRemarks,
    }).subscribe({
      next: (res: any) => {
        vm.settingsLoading = false;
        if (res.success) {
          vm.settingsCompanyName = res.settings?.companyName || vm.settingsCompanyName;
          vm.dashboardCompany = vm.settingsCompanyName || vm.dashboardCompany;
          vm.settingsSaveSuccess = 'Settings saved successfully!';
          setTimeout(() => vm.settingsSaveSuccess = '', 3000);
        } else {
          vm.settingsSaveError = res.message || 'Failed to save settings.';
        }
      },
      error: (err: any) => {
        vm.settingsLoading = false;
        vm.settingsSaveError = err?.error?.message || 'Server error saving settings.';
      },
    });
  }

  addLeadStatus(vm: any): void {
    const status = vm.newLeadStatusInput.trim();
    if (!status) return;
    if (vm.settingsLeadStatuses.includes(status)) {
      vm.settingsSaveError = 'Status already exists.';
      setTimeout(() => vm.settingsSaveError = '', 3000);
      return;
    }
    vm.settingsLeadStatuses.push(status);
    vm.newLeadStatusInput = '';
  }

  toggleStatusForPage(vm: any, status: string, page: 'interested' | 'dnp' | 'converted'): void {
    let list: string[] = [];
    if (page === 'interested') list = vm.settingsInterestedPageStatuses;
    else if (page === 'dnp') list = vm.settingsDnpPageStatuses;
    else if (page === 'converted') list = vm.settingsConvertedPageStatuses;

    const idx = list.indexOf(status);
    if (idx > -1) {
      list.splice(idx, 1);
    } else {
      list.push(status);
    }
  }

  removeLeadStatus(vm: any, status: string): void {
    const protectedStatuses = ['New', 'Interested', 'Not Connected', 'Converted', 'Follow Up', 'Not Interested'];
    if (protectedStatuses.includes(status)) {
      vm.settingsSaveError = `The status "${status}" is a core workflow stage and cannot be deleted.`;
      setTimeout(() => vm.settingsSaveError = '', 4000);
      return;
    }
    vm.settingsLeadStatuses = vm.settingsLeadStatuses.filter((item: string) => item !== status);
    vm.settingsInterestedPageStatuses = vm.settingsInterestedPageStatuses.filter((item: string) => item !== status);
    vm.settingsDnpPageStatuses = vm.settingsDnpPageStatuses.filter((item: string) => item !== status);
    vm.settingsConvertedPageStatuses = vm.settingsConvertedPageStatuses.filter((item: string) => item !== status);
  }

  startBreakNotifPolling(vm: any): void {
    vm.fetchBreakOverLimit();
    vm.breakPollInterval = setInterval(() => vm.fetchBreakOverLimit(), 60000);
  }

  fetchBreakOverLimit(vm: any): void {
    if (!vm.dashboardCode) return;
    this.authService.getBreaklogToday(vm.dashboardCode).subscribe({
      next: (res: any) => {
        if (res.success) {
          vm.breakOverLimitEmps = res.overLimit || [];
          vm.breakNotifCount = vm.breakOverLimitEmps.length;
        }
      },
      error: () => {},
    });
  }

  toggleBreakNotifPanel(vm: any): void {
    vm.showBreakNotifPanel = !vm.showBreakNotifPanel;
  }

  fmtSecs(vm: any, totalSecs: number): string {
    return formatSeconds(totalSecs);
  }

  openShareModal(vm: any): void {
    if (!vm.companyProfile) return;
    const code = vm.companyProfile.companyCode || 'N/A';
    const email = vm.companyProfile.email || 'N/A';
    const mobile = vm.companyProfile.mobile || 'N/A';

    vm.shareMessage = `Hello,

To register your employee using Callyzer Biz mobile app, please follow the step-by-step instructions mentioned in the link below:
https://help.callyzer.co/article/how-to-register-your-employees

Please use below unique device connect code to register. Your Device Connect Code is ${code}.

If you encounter any difficulties, please contact at ${email} or ${mobile}

Thank You.`;
    vm.showShareModal = true;
  }

  copyShareMessage(vm: any): void {
    navigator.clipboard.writeText(vm.shareMessage).then(() => {
      alert('Message copied to clipboard!');
      vm.showShareModal = false;
    });
  }

  startEditAddress(vm: any): void {
    vm.editingAddress = true;
    vm.editAddressValue = vm.companyProfile?.companyAddress || '';
    vm.saveAddressError = '';
    vm.saveAddressSuccess = '';
  }

  cancelEditAddress(vm: any): void {
    vm.editingAddress = false;
    vm.saveAddressError = '';
  }

  saveAddress(vm: any): void {
    vm.saveAddressLoading = true;
    vm.saveAddressError = '';
    vm.saveAddressSuccess = '';
    this.authService.updateAddress(vm.dashboardCode, vm.editAddressValue).subscribe({
      next: (res: any) => {
        vm.saveAddressLoading = false;
        if (res.success) {
          vm.companyProfile.companyAddress = res.companyAddress;
          const raw = localStorage.getItem('tracecall_user');
          if (raw) {
            try {
              const user = JSON.parse(raw);
              user.companyAddress = res.companyAddress;
              localStorage.setItem('tracecall_user', JSON.stringify(user));
            } catch { }
          }
          vm.editingAddress = false;
          vm.saveAddressSuccess = 'Address updated!';
          setTimeout(() => vm.saveAddressSuccess = '', 3000);
        } else {
          vm.saveAddressError = res.message;
        }
      },
      error: (err: any) => {
        vm.saveAddressLoading = false;
        vm.saveAddressError = err?.error?.message || 'Server error.';
      },
    });
  }

  startEditTeamSize(vm: any): void {
    vm.editingTeamSize = true;
    vm.editTeamSizeValue = vm.companyProfile?.teamSize || '';
    vm.saveTeamSizeError = '';
    vm.saveTeamSizeSuccess = '';
  }

  cancelEditTeamSize(vm: any): void {
    vm.editingTeamSize = false;
    vm.saveTeamSizeError = '';
  }

  saveTeamSize(vm: any): void {
    if (!vm.editTeamSizeValue || parseInt(vm.editTeamSizeValue.toString()) < 1) {
      vm.saveTeamSizeError = 'Please enter a valid team size (minimum 1).';
      return;
    }

    vm.saveTeamSizeLoading = true;
    vm.saveTeamSizeError = '';
    vm.saveTeamSizeSuccess = '';
    this.authService.updateTeamSize(vm.dashboardCode, vm.editTeamSizeValue.toString()).subscribe({
      next: (res: any) => {
        vm.saveTeamSizeLoading = false;
        if (res.success) {
          vm.companyProfile.teamSize = res.teamSize;
          vm.dashboardTeamSize = parseInt(res.teamSize);

          const raw = localStorage.getItem('tracecall_user');
          if (raw) {
            try {
              const user = JSON.parse(raw);
              user.teamSize = res.teamSize;
              localStorage.setItem('tracecall_user', JSON.stringify(user));
            } catch { }
          }

          vm.editingTeamSize = false;
          vm.saveTeamSizeSuccess = 'Team size updated!';
          setTimeout(() => vm.saveTeamSizeSuccess = '', 3000);
        } else {
          vm.saveTeamSizeError = res.message;
        }
      },
      error: (err: any) => {
        vm.saveTeamSizeLoading = false;
        vm.saveTeamSizeError = err?.error?.message || 'Server error.';
      },
    });
  }

  onChangePwdInput(vm: any, value: string): void {
    vm.changePwdForm.newPassword = value;
    vm.changePwdChecks = {
      length: value.length >= 8,
      upper: /[A-Z]/.test(value),
      number: /[0-9]/.test(value),
      symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value),
    };
  }

  changePwdStrong(vm: any): boolean {
    return Object.values(vm.changePwdChecks).every(Boolean);
  }

  onChangePasswordSubmit(vm: any, event: Event): void {
    event.preventDefault();
    vm.changePwdError = '';
    vm.changePwdSuccess = '';
    if (vm.changePwdForm.newPassword !== vm.changePwdForm.confirmPassword) {
      vm.changePwdError = 'New passwords do not match.';
      return;
    }
    if (!vm.changePwdStrong) {
      vm.changePwdError = 'New password does not meet strength requirements.';
      return;
    }
    vm.changePwdLoading = true;
    const payload = { oldPassword: vm.changePwdForm.oldPassword, newPassword: vm.changePwdForm.newPassword };
    this.authService.changePassword(vm.dashboardCode, payload).subscribe({
      next: (res: any) => {
        vm.changePwdLoading = false;
        if (res.success) {
          vm.changePwdSuccess = 'Password updated successfully!';
          vm.changePwdForm = { oldPassword: '', newPassword: '', confirmPassword: '' };
          vm.changePwdChecks = { length: false, upper: false, number: false, symbol: false };
        } else {
          vm.changePwdError = res.message;
        }
      },
      error: (err: any) => {
        vm.changePwdLoading = false;
        vm.changePwdError = err?.error?.message || 'Server error.';
      },
    });
  }
}
