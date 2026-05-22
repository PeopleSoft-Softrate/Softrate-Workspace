export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface PageResult<T> extends PageRequest {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface CompanyGroup {
  name: string;
  count: number;
}
