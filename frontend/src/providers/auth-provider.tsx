"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearTokens, hydrateRefreshToken, setTokens } from "@/lib/api-client";
import type {
  AuthSessionResponse,
  LoginResponse,
  MeResponse,
  Organization,
  PlatformAdmin,
  PlatformAuthSessionResponse,
  User,
} from "@/types";

export interface LoginResult {
  mfaRequired: boolean;
  mfaToken?: string;
}

interface AuthContextValue {
  user: User | null;
  organization: Organization | null;
  platformAdmin: PlatformAdmin | null;
  actorType: "user" | "platform" | null;
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
  login: (email: string, password: string, organizationSlug: string) => Promise<LoginResult>;
  verifyMfaLogin: (mfaToken: string, code: string) => Promise<void>;
  completeSsoExchange: (token: string) => Promise<LoginResult>;
  platformLogin: (email: string, password: string) => Promise<LoginResult>;
  register: (data: RegisterInput) => Promise<void>;
  acceptInvite: (body: { token: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

interface RegisterInput {
  organizationName: string;
  organizationSlug: string;
  admin: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [platformAdmin, setPlatformAdmin] = useState<PlatformAdmin | null>(null);
  const [actorType, setActorType] = useState<"user" | "platform" | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(() => {
    setUser(null);
    setOrganization(null);
    setPlatformAdmin(null);
    setActorType(null);
    setPermissions([]);
  }, []);

  const applyAuth = useCallback((data: MeResponse) => {
    if (data.type === "platform" && data.admin) {
      setPlatformAdmin(data.admin);
      setUser(null);
      setOrganization(null);
      setActorType("platform");
      setPermissions(data.permissions ?? []);
      return;
    }
    if (data.user) {
      setUser(data.user);
      setOrganization(data.organization ?? null);
      setPlatformAdmin(null);
      setActorType("user");
      setPermissions(data.permissions ?? []);
    }
  }, []);

  const refreshMe = useCallback(async (options?: { keepSessionOnFailure?: boolean }) => {
    hydrateRefreshToken();
    try {
      const data = await api.get<MeResponse>("/auth/me");
      applyAuth(data);
    } catch {
      if (!options?.keepSessionOnFailure) {
        clearTokens();
        clearAuth();
      }
    }
  }, [applyAuth, clearAuth]);

  useEffect(() => {
    hydrateRefreshToken();
    refreshMe().finally(() => setIsLoading(false));
  }, [refreshMe]);

  const login = useCallback(
    async (email: string, password: string, organizationSlug: string): Promise<LoginResult> => {
      const data = await api.post<LoginResponse>(
        "/auth/login",
        { email, password, organizationSlug },
        { auth: false }
      );
      if (data.mfaRequired && data.mfaToken) {
        return { mfaRequired: true, mfaToken: data.mfaToken };
      }
      if (!data.tokens?.accessToken) {
        throw new Error("Invalid login response");
      }
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      await refreshMe();
      router.push("/dashboard");
      return { mfaRequired: false };
    },
    [refreshMe, router]
  );

  const verifyMfaLogin = useCallback(
    async (mfaToken: string, code: string) => {
      const data = await api.post<AuthSessionResponse>(
        "/auth/mfa/login",
        { mfaToken, code },
        { auth: false }
      );
      if (!data.tokens?.accessToken) {
        throw new Error("Invalid MFA login response");
      }
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      if ("admin" in data && data.admin) {
        applyAuth({ type: "platform", admin: data.admin, permissions: [] });
      }
      await refreshMe({ keepSessionOnFailure: "admin" in data && Boolean(data.admin) });
      if ("admin" in data && data.admin) {
        router.push("/platform");
        return;
      }
      router.push("/dashboard");
    },
    [applyAuth, refreshMe, router]
  );

  const completeSsoExchange = useCallback(
    async (token: string): Promise<LoginResult> => {
      const data = await api.post<LoginResponse>(
        "/auth/sso/exchange",
        { token },
        { auth: false }
      );
      if (data.mfaRequired && data.mfaToken) {
        return { mfaRequired: true, mfaToken: data.mfaToken };
      }
      if (!data.tokens?.accessToken) {
        throw new Error("Invalid SSO exchange response");
      }
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      await refreshMe();
      router.push("/dashboard");
      return { mfaRequired: false };
    },
    [refreshMe, router]
  );

  const platformLogin = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const data = await api.post<PlatformAuthSessionResponse>(
        "/auth/platform/login",
        { email, password },
        { auth: false }
      );
      if (data.mfaRequired && data.mfaToken) {
        return { mfaRequired: true, mfaToken: data.mfaToken };
      }
      if (!data.tokens?.accessToken) {
        throw new Error("Invalid platform login response");
      }
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      if (data.admin) {
        applyAuth({ type: "platform", admin: data.admin, permissions: [] });
      }
      await refreshMe({ keepSessionOnFailure: Boolean(data.admin) });
      router.push("/platform");
      return { mfaRequired: false };
    },
    [applyAuth, refreshMe, router]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const data = await api.post<AuthSessionResponse>("/auth/register", input, { auth: false });
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      await refreshMe();
      router.push("/dashboard");
    },
    [refreshMe, router]
  );

  const acceptInvite = useCallback(
    async (body: { token: string; password: string; firstName: string; lastName: string }) => {
      const data = await api.post<AuthSessionResponse>("/auth/accept-invite", body, { auth: false });
      if (data.tokens?.accessToken) {
        setTokens(data.tokens.accessToken, data.tokens.refreshToken);
        await refreshMe();
        router.push("/dashboard");
        return;
      }
      const params = new URLSearchParams();
      if (data.user?.email) params.set("email", data.user.email);
      if (data.organization?.slug) params.set("organizationSlug", data.organization.slug);
      const qs = params.toString();
      router.push(qs ? `/login?${qs}` : "/login");
    },
    [refreshMe, router]
  );

  const logout = useCallback(async () => {
    const wasPlatform = actorType === "platform";
    const params = new URLSearchParams();
    if (user?.email) params.set("email", user.email);
    if (organization?.slug) params.set("organizationSlug", organization.slug);
    const loginQs = params.toString();
    try {
      await api.post("/auth/logout", {});
    } catch {
      // ignore
    } finally {
      clearTokens();
      clearAuth();
      if (wasPlatform) {
        router.push("/platform/login");
      } else {
        router.push(loginQs ? `/login?${loginQs}` : "/login");
      }
    }
  }, [actorType, clearAuth, organization?.slug, router, user?.email]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      organization,
      platformAdmin,
      actorType,
      permissions,
      isLoading,
      isAuthenticated: !!user || !!platformAdmin,
      isPlatformAdmin: actorType === "platform",
      login,
      verifyMfaLogin,
      completeSsoExchange,
      platformLogin,
      register,
      acceptInvite,
      logout,
      refreshMe,
      hasPermission: (permission: string) => permissions.includes(permission),
    }),
    [
      user,
      organization,
      platformAdmin,
      actorType,
      permissions,
      isLoading,
      login,
      verifyMfaLogin,
      completeSsoExchange,
      platformLogin,
      register,
      acceptInvite,
      logout,
      refreshMe,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
