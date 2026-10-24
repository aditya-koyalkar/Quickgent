const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiError {
  message: string | string[];
  statusCode: number;
  error?: string;
}

export class ApiRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorBody: ApiError = await response.json().catch(() => ({
      message: 'An unexpected error occurred',
      statusCode: response.status,
    }));

    const message = Array.isArray(errorBody.message)
      ? errorBody.message[0]
      : errorBody.message;

    throw new ApiRequestError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ── Generic request helpers ─────────────────────────────────────────
export const api = {
  get: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
};

// ── Auth types ──────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface SignUpPayload {
  username: string;
  email: string;
  password: string;
}

export interface SignInPayload {
  emailOrUsername: string;
  password: string;
}

// ── Auth API functions (used by TanStack mutations/queries) ─────────
export const authApi = {
  signUp: (data: SignUpPayload) =>
    api.post<AuthResponse>('/auth/signup', data),

  signIn: (data: SignInPayload) =>
    api.post<AuthResponse>('/auth/signin', data),

  refresh: () =>
    api.post<{ tokens: AuthTokens }>('/auth/refresh'),

  logout: () =>
    api.post<{ message: string }>('/auth/logout'),

  logoutAll: () =>
    api.post<{ message: string }>('/auth/logout-all'),

  getMe: () =>
    api.get<AuthUser>('/auth/me'),
};
