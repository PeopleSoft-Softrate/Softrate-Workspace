import { Component } from '@angular/core';
import { AdminWorkspaceComponent } from '../../features/admin-workspace/admin-workspace.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AdminWorkspaceComponent],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.css',
})
export class AppComponent {}
