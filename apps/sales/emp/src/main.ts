import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/core/layout/employee-shell.component';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
