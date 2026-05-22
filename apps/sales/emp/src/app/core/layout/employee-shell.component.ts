import { Component } from '@angular/core';
import { EmployeeWorkspaceComponent } from '../../features/workspace/employee-workspace.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [EmployeeWorkspaceComponent],
  templateUrl: './employee-shell.component.html',
  styleUrl: './employee-shell.component.css',
})
export class App {}
