export type AppRole = 'admin' | 'employee';

export type DataScope = 'own' | 'assigned' | 'team' | 'all';

export interface FeaturePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
  scope: DataScope;
}

export const EMPLOYEE_ASSIGNED_ACCESS: FeaturePermission = {
  view: true,
  create: false,
  edit: true,
  delete: false,
  export: false,
  scope: 'assigned',
};
