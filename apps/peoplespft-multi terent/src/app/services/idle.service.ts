import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class IdleService {
  private router = inject(Router);
  private ngZone = inject(NgZone);
  
  private idleTimeoutMinutes = 15; // Auto-logout after 15 minutes of inactivity
  private idleTimeoutMilliseconds = this.idleTimeoutMinutes * 60 * 1000;
  private timeoutId: any;
  private isListening = false;

  constructor() {}

  startWatching() {
    if (this.isListening) return;
    
    this.ngZone.runOutsideAngular(() => {
      // Listen to these events outside Angular to prevent triggering change detection unnecessarily
      window.addEventListener('mousemove', this.resetTimer.bind(this));
      window.addEventListener('mousedown', this.resetTimer.bind(this));
      window.addEventListener('keypress', this.resetTimer.bind(this));
      window.addEventListener('DOMMouseScroll', this.resetTimer.bind(this));
      window.addEventListener('mousewheel', this.resetTimer.bind(this));
      window.addEventListener('touchmove', this.resetTimer.bind(this));
      window.addEventListener('MSPointerMove', this.resetTimer.bind(this));
    });

    this.isListening = true;
    this.resetTimer();
  }

  stopWatching() {
    if (!this.isListening) return;
    
    window.removeEventListener('mousemove', this.resetTimer.bind(this));
    window.removeEventListener('mousedown', this.resetTimer.bind(this));
    window.removeEventListener('keypress', this.resetTimer.bind(this));
    window.removeEventListener('DOMMouseScroll', this.resetTimer.bind(this));
    window.removeEventListener('mousewheel', this.resetTimer.bind(this));
    window.removeEventListener('touchmove', this.resetTimer.bind(this));
    window.removeEventListener('MSPointerMove', this.resetTimer.bind(this));
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    this.isListening = false;
  }

  private resetTimer() {
    // Check if user is actually logged in. If not, don't set timeout.
    const token = localStorage.getItem('auth_token');
    if (!token) {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      return;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    this.ngZone.runOutsideAngular(() => {
      this.timeoutId = setTimeout(() => {
        this.ngZone.run(() => {
          this.logout();
        });
      }, this.idleTimeoutMilliseconds);
    });
  }

  private logout() {
    // Clear user session
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_data');
    localStorage.removeItem('active_company_id');
    localStorage.removeItem('active_tenant_id');
    
    this.stopWatching();
    
    // Redirect to login page
    this.router.navigate(['/login']);
    
    // Optionally, you can show a generic alert or a custom toast
    // alert('Your session has expired due to inactivity. Please log in again.');
  }
}
