export type { DataScope, TenantContext } from './tenant';

export type ActorType = 'user' | 'platform';

export type RoleName = 'ORG_ADMIN' | 'MANAGER' | 'INSTRUCTOR' | 'EMPLOYEE' | 'SUPER_ADMIN';

export interface JwtAccessClaims {
  sub: string;
  actorType: ActorType;
  organizationId: string | null;
  role: RoleName;
  typ: 'access';
  fam: string;
  jti: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface JwtRefreshClaims {
  sub: string;
  actorType: ActorType;
  typ: 'refresh';
  fam: string;
  jti: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export type AccessJwtPayload = JwtAccessClaims;
export type RefreshJwtPayload = JwtRefreshClaims;

export interface AuthPrincipal {
  actorType: ActorType;
  sub: string;
  email: string;
  organizationId: string | null;
  role: RoleName;
  permissions: string[];
  tokenFamilyId: string;
  departmentId?: string | null;
  teamId?: string | null;
  divisionId?: string | null;
  viaApiKey?: boolean;
}
