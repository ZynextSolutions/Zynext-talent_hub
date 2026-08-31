import type { SsoConfig } from '../types/dto';

export function publicSsoSettings(sso: SsoConfig | undefined): SsoConfig | undefined {
  if (!sso) return undefined;
  const { clientSecret: _secret, ...rest } = sso;
  return { ...rest, clientSecretSet: Boolean(sso.clientSecret) };
}
