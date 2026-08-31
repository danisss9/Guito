import { HttpInterceptorFn } from '@angular/common/http';

const tokenParameter = 'guitoToken';

export function getGuitoToken(): string {
  return new URLSearchParams(window.location.search).get(tokenParameter) ?? '';
}

export const guitoTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const token = getGuitoToken();
  if (!token || !request.url.startsWith('/api')) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: { 'X-Guito-Token': token },
    }),
  );
};

export function authenticatedApiUrl(path: string): string {
  const url = new URL(path, window.location.origin);
  const token = getGuitoToken();
  if (token) {
    url.searchParams.set(tokenParameter, token);
  }
  return url.toString();
}
