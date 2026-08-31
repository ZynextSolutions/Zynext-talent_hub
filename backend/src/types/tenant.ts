export type IsolationMode = 'strict' | 'platform' | 'job';

export interface TenantContext {
  organizationId: string;
  isolation: IsolationMode;
}

export type ScopeKind = 'org' | 'department' | 'team' | 'self';

export interface DataScope {
  kind: ScopeKind;
  departmentId?: string;
  teamId?: string;
  userId?: string;
}
