import { Directive, Input } from '@angular/core';
import type { EmployeeWorkspaceComponent } from './employee-workspace.component';

const EmployeeWorkspaceViewModel = class {} as unknown as new () => EmployeeWorkspaceComponent;

@Directive()
export abstract class EmployeeWorkspaceSectionProxy extends EmployeeWorkspaceViewModel {
  @Input({ required: true }) vm!: EmployeeWorkspaceComponent;

  protected constructor() {
    super();

    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target) return Reflect.get(target, prop, receiver);
        const vm = target.vm as any;
        if (!vm) return undefined;
        const value = vm[prop as keyof EmployeeWorkspaceComponent];
        return typeof value === 'function' ? value.bind(vm) : value;
      },
      set(target, prop, value, receiver) {
        if (prop === 'vm' || prop in target || !target.vm) {
          return Reflect.set(target, prop, value, receiver);
        }

        const vm = target.vm as any;
        if (prop in vm) {
          vm[prop] = value;
          return true;
        }

        return Reflect.set(target, prop, value, receiver);
      },
    });
  }
}
