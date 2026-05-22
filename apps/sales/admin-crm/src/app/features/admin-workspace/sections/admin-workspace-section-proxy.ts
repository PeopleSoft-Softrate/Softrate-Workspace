import { Directive, Input } from '@angular/core';
import type { AdminWorkspaceComponent } from '../admin-workspace.component';

const AdminWorkspaceViewModel = class {} as unknown as new () => AdminWorkspaceComponent;

@Directive()
export abstract class AdminWorkspaceSectionProxy extends AdminWorkspaceViewModel {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;

  protected constructor() {
    super();

    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target) return Reflect.get(target, prop, receiver);
        const vm = target.vm as any;
        if (!vm) return undefined;
        const value = vm[prop as keyof AdminWorkspaceComponent];
        return typeof value === 'function' ? value.bind(vm) : value;
      },
      set(target, prop, value, receiver) {
        if (prop === 'vm' || prop in target || !target.vm) {
          return Reflect.set(target, prop, value, receiver);
        }

        const vm = target.vm as any;
        if (prop in vm) {
          vm[prop as keyof AdminWorkspaceComponent] = value;
          return true;
        }

        return Reflect.set(target, prop, value, receiver);
      }
    });
  }
}
