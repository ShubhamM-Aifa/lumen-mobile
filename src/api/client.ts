/**
 * Lightweight API client — wraps fetch, attaches the JWT access token,
 * and handles 401 token refresh automatically.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

// Use EXPO_PUBLIC_API_URL if configured, falling back to app.config.js extra or localhost
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  extra.apiUrl ||
  'http://localhost:3000/api/v1';

const KEYS = {
  accessToken:  'lumen_access_token',
  refreshToken: 'lumen_refresh_token',
};

// expo-secure-store is native-only; fall back to localStorage on web
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch {}
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async delete(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch {}
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const ACTIVE_ACCOUNT_KEY = 'lumen_active_account_id';

export async function getActiveAccountId(): Promise<string | null> {
  return storage.get(ACTIVE_ACCOUNT_KEY);
}

export async function setActiveAccountId(userId: string | null): Promise<void> {
  if (userId) {
    await storage.set(ACTIVE_ACCOUNT_KEY, userId);
  } else {
    await storage.delete(ACTIVE_ACCOUNT_KEY);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return storage.get(KEYS.accessToken);
}

export async function saveTokens(accessToken: string, refreshToken: string, userId?: string): Promise<void> {
  await Promise.all([
    storage.set(KEYS.accessToken, accessToken),
    storage.set(KEYS.refreshToken, refreshToken),
  ]);
  const uid = userId || (await getActiveAccountId());
  if (uid) {
    await saveAccountTokens(uid, accessToken, refreshToken);
  }
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    storage.delete(KEYS.accessToken),
    storage.delete(KEYS.refreshToken),
  ]);
}

export async function saveAccountTokens(userId: string, accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    storage.set(`lumen_access_token_${userId}`, accessToken),
    storage.set(`lumen_refresh_token_${userId}`, refreshToken),
  ]);
}

export async function getAccountTokens(userId: string): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const [accessToken, refreshToken] = await Promise.all([
    storage.get(`lumen_access_token_${userId}`),
    storage.get(`lumen_refresh_token_${userId}`),
  ]);
  return { accessToken, refreshToken };
}

export async function clearAccountTokens(userId: string): Promise<void> {
  await Promise.all([
    storage.delete(`lumen_access_token_${userId}`),
    storage.delete(`lumen_refresh_token_${userId}`),
  ]);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await storage.get(KEYS.refreshToken);
  if (!refreshToken) return null;
  try {
    const resp = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!resp.ok) return null;
    const json = await resp.json() as { data: { accessToken: string; refreshToken: string } };
    await saveTokens(json.data.accessToken, json.data.refreshToken);
    return json.data.accessToken;
  } catch {
    return null;
  }
}

/** A "contact your doctor" notice the server attaches to a log response. Fixed wording, never written by a model. */
export interface SafetyFlag {
  id: string;
  level: 'today' | 'now';
  title: string;
  message: string;
}

let safetyListener: ((flags: SafetyFlag[]) => void) | null = null;

/** The app registers one handler that shows these notices, wherever the log was saved from. */
export function setSafetyListener(listener: ((flags: SafetyFlag[]) => void) | null): void {
  safetyListener = listener;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const resp = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  const isPublicAuthEndpoint =
    path === '/auth/login' ||
    path === '/auth/register' ||
    path === '/auth/refresh' ||
    path === '/auth/google';
  if (resp.status === 401 && retry && !isPublicAuthEndpoint) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiRequest<T>(path, options, false);
    }
    await clearTokens();
    throw new ApiError(401, 'Session expired — please log in again');
  }

  let json: { success?: boolean; data?: T; message?: string; errors?: unknown[]; safety?: { flags?: SafetyFlag[] } } = {};
  try {
    const text = await resp.text();
    if (text) {
      json = JSON.parse(text);
    }
  } catch {
    json = {};
  }

  if (!resp.ok) {
    let errorDetails = '';
    if (Array.isArray(json.errors) && json.errors.length > 0) {
      errorDetails = ': ' + json.errors
        .map((e: any) => `${e.field ? e.field + ': ' : ''}${e.message || JSON.stringify(e)}`)
        .join(', ');
    } else if (typeof json.errors === 'string') {
      errorDetails = `: ${json.errors}`;
    }
    const fullMessage = (json.message ?? 'Request failed') + errorDetails;
    console.error(`[API Error ${resp.status}] ${path}:`, fullMessage, json.errors);
    throw new ApiError(resp.status, fullMessage, json.errors);
  }

  if (json.safety?.flags?.length) {
    try { safetyListener?.(json.safety.flags); } catch { /* showing a notice must never break saving */ }
  }

  return (json.data !== undefined ? json.data : (json as unknown as T));
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errors?: unknown[];

  constructor(statusCode: number, message: string, errors?: unknown[]) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

/**
 * Download a binary response (PDF, CSV) as a base64 string.
 * Returns { base64, contentType }.
 */
export async function apiDownload(
  path: string,
  body: unknown,
  retry = true,
): Promise<{ base64: string; contentType: string }> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/octet-stream, application/pdf, text/csv',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const resp = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (resp.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) return apiDownload(path, body, false);
    await clearTokens();
    throw new ApiError(401, 'Session expired — please log in again');
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => 'Request failed');
    let msg = text;
    try {
      const json = JSON.parse(text);
      if (json.message) {
        msg = json.message;
        if (Array.isArray(json.errors) && json.errors.length > 0) {
          msg += ': ' + json.errors.map((e: any) => `${e.field ? e.field + ': ' : ''}${e.message || JSON.stringify(e)}`).join(', ');
        }
      }
    } catch {}
    console.error(`[apiDownload Error ${resp.status}] ${path}:`, msg);
    throw new ApiError(resp.status, msg);
  }

  const contentType = resp.headers.get('Content-Type') ?? 'application/octet-stream';
  const arrayBuffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  const base64 = btoa(binary);
  return { base64, contentType };
}

// Shorthand helpers
export const api = {
  get:    <T>(path: string, opts?: { params?: Record<string, unknown> }) => {
    const qs = opts?.params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(opts.params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString() : '';
    return apiRequest<T>(path + qs);
  },
  post:   <T>(path: string, body: unknown)                 => apiRequest<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)                 => apiRequest<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)                 => apiRequest<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                                => apiRequest<T>(path, { method: 'DELETE' }),
};
