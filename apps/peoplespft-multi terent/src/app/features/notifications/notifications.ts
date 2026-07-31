import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { Notification01Icon, TaskDone01Icon } from '@hugeicons/core-free-icons';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule, HugeiconsIconComponent],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css'
})
export class NotificationsComponent implements OnInit {
  apiService = inject(ApiService);

  Notification01Icon = Notification01Icon;
  TaskDone01Icon = TaskDone01Icon;

  notifications = signal<any[]>([]);
  isLoading = signal(true);
  
  ngOnInit() {
    this.fetchNotifications();
  }
  
  fetchNotifications() {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('user_data');
      if (data && data !== 'undefined' && data !== 'null') {
        try {
          const user = JSON.parse(data);
          let role = user.role ? user.role.toLowerCase() : '';
          if (!role) {
            role = user.internid ? 'intern' : (user.EmployeeId ? 'employee' : 'all');
          }
          const userId = user._id || user.id || user.internid || user.EmployeeId;

          this.apiService.getNotifications(role, userId).subscribe({
            next: (res) => {
              if (res && res.success) {
                this.notifications.set(res.notifications || []);
              }
              this.isLoading.set(false);
            },
            error: () => {
              this.isLoading.set(false);
            }
          });
          return;
        } catch (e) {
          // ignore
        }
      }
    }
    
    this.isLoading.set(false);
  }

  markAsRead(notification: any) {
    if (notification.read) return;
    this.apiService.markNotificationRead(notification._id).subscribe({
      next: () => {
        this.notifications.update(notifs => notifs.map(n => 
          n._id === notification._id ? { ...n, read: true } : n
        ));
      }
    });
  }
  
  goBack() {
    window.history.back();
  }
}
