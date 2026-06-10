import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('auth_token');
  const isDemoMode = localStorage.getItem('demo_mode') === 'true';
  
  let headers = req.headers;
  
  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (isDemoMode) {
    headers = headers.set('X-Demo-Mode', 'true');
  }

  if (headers !== req.headers) {
    const clonedReq = req.clone({ headers });
    return next(clonedReq);
  }
  
  return next(req);
};
