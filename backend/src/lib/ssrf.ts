import { AppError } from '../errors/app-error';
import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTS = new Set(['metadata.google.internal', 'metadata.google.internal.']);
const FETCH_TIMEOUT_MS = 5000;

function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0 || a === 100) return true;
    return false;
  }
  if (net.isIP(ip) === 6) {
    const normalized = ip.toLowerCase();
    if (normalized.startsWith('::ffff:')) {
      return isPrivateIp(normalized.slice('::ffff:'.length));
    }
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80')
    );
  }
  return true;
}

export async function assertSafeOutboundUrl(raw: string, label = 'URL'): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw AppError.from('VALIDATION_ERROR', `${label} is invalid.`);
  }
  if (url.protocol !== 'https:') {
    if (process.env.NODE_ENV === 'production' || url.protocol !== 'http:') {
      throw AppError.from('VALIDATION_ERROR', `${label} must use HTTPS.`);
    }
  }
  if (url.username || url.password) {
    throw AppError.from('VALIDATION_ERROR', `${label} must not include credentials.`);
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.internal')) {
    throw AppError.from('VALIDATION_ERROR', `${label} host is not allowed.`);
  }
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw AppError.from('VALIDATION_ERROR', `${label} host is not allowed.`);
    }
    return url;
  }
  let addresses: string[] = [];
  try {
    const resolved = await dns.lookup(hostname, { all: true });
    addresses = resolved.map((row) => row.address);
  } catch {
    throw AppError.from('VALIDATION_ERROR', `${label} host could not be resolved.`);
  }
  if (!addresses.length || addresses.some(isPrivateIp)) {
    throw AppError.from('VALIDATION_ERROR', `${label} host is not allowed.`);
  }
  return url;
}

export async function assertSafeWebhookUrl(raw: string): Promise<URL> {
  return assertSafeOutboundUrl(raw, 'Webhook URL');
}

export async function fetchSafe(url: string, init: RequestInit = {}, label = 'URL'): Promise<Response> {
  await assertSafeOutboundUrl(url, label);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, redirect: 'error', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function postWebhook(url: string, init: RequestInit): Promise<Response> {
  return fetchSafe(url, { ...init, method: init.method ?? 'POST' }, 'Webhook URL');
}
