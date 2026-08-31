import type { AuthPrincipal } from './auth';
import type { DataScope, TenantContext } from './tenant';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPrincipal;
      tenant?: TenantContext;
      scope?: DataScope;
      requestId: string;
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
      jobAllOrganizations?: boolean;
    }
  }
}

export {};
