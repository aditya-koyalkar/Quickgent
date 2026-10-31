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

let refreshPromise: Promise<boolean> | null = null;

async function executeRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    refreshPromise = null;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const isAuthEndpoint =
    endpoint.startsWith('/auth/signin') ||
    endpoint.startsWith('/auth/signup') ||
    endpoint.startsWith('/auth/refresh') ||
    endpoint.startsWith('/auth/logout');

  // If a refresh is already in-flight, wait for it before sending new non-auth requests
  if (!isAuthEndpoint && refreshPromise) {
    await refreshPromise;
  }

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
    // Attempt automatic refresh on 401 for non-auth requests
    if (response.status === 401 && !isAuthEndpoint && retry) {
      if (!refreshPromise) {
        refreshPromise = executeRefresh();
      }

      const refreshed = await refreshPromise;
      if (refreshed) {
        // Retry the original request once with newly issued cookies
        return request<T>(endpoint, options, false);
      }
    }

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
  username: string | null;
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

// ── Project types ───────────────────────────────────────────────────
export interface ProjectItem {
  id: string;
  name: string;
  isActive: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    workflows: number;
    conversations: number;
  };
}

export interface WorkflowItem {
  id: string;
  note?: string | null;
  version: string;
  isLive: boolean;
  graph: any;
  projectId: string;
  project?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectItem {
  workflows: WorkflowItem[];
  conversations: Array<{
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    messages: Array<{
      id: string;
      role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
      content: any;
      metadata: any;
      model?: string;
      createdAt: string;
    }>;
  }>;
}

export interface ProjectsResponse {
  data: ProjectItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── Projects API functions ──────────────────────────────────────────
export const projectsApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return api.get<ProjectsResponse>(`/projects${query ? `?${query}` : ''}`);
  },

  get: (id: string) => api.get<ProjectDetail>(`/projects/${id}`),

  create: (data: { name?: string }) => api.post<ProjectItem>('/projects', data),

  update: (id: string, data: { name?: string; isActive?: boolean }) =>
    api.patch<ProjectItem>(`/projects/${id}`, data),
};

// ── Workflows API functions ─────────────────────────────────────────
export interface CreateWorkflowPayload {
  version: string;
  json: Record<string, any>;
  note?: string;
}

export interface UpdateWorkflowPayload {
  json?: Record<string, any>;
  note?: string;
}

export const workflowsApi = {
  list: (projectId: string, isLive?: boolean) => {
    const query = isLive !== undefined ? `?isLive=${isLive}` : '';
    return api.get<WorkflowItem[]>(`/projects/${projectId}/workflows${query}`);
  },

  get: (projectId: string, version: string) =>
    api.get<WorkflowItem>(`/projects/${projectId}/workflows/${version}`),

  create: (projectId: string, data: CreateWorkflowPayload) =>
    api.post<WorkflowItem>(`/projects/${projectId}/workflows`, data),

  update: (projectId: string, version: string, data: UpdateWorkflowPayload) =>
    api.patch<WorkflowItem>(`/projects/${projectId}/workflows/${version}`, data),

  makeLive: (projectId: string, version: string) =>
    api.post<WorkflowItem>(`/projects/${projectId}/workflows/${version}/live`),

  delete: (projectId: string, version: string) =>
    api.delete<{ success: boolean; message: string }>(
      `/projects/${projectId}/workflows/${version}`,
    ),

  getLive: (projectId: string) =>
    api.get<WorkflowItem>(`/projects/${projectId}/workflows/live`),

  getLiveById: (workflowOrProjectId: string) =>
    api.get<WorkflowItem>(`/live/${workflowOrProjectId}`),

  executeLive: (
    projectId: string,
    data: {
      inputs?: Record<string, any>;
      message?: string;
      user_message?: string;
      sessionId?: string;
    },
  ) =>
    api.post<LiveWorkflowExecutionResult>(
      `/projects/${projectId}/workflows/live/run`,
      data,
    ),

  chatLive: (
    projectId: string,
    data: {
      message: string;
      conversationId?: string;
      sessionId?: string;
    },
  ) =>
    api.post<LiveWorkflowChatResult>(
      `/projects/${projectId}/workflows/live/chat`,
      data,
    ),

  chatLiveById: (
    workflowOrProjectId: string,
    data: {
      message: string;
      conversationId?: string;
      sessionId?: string;
    },
  ) =>
    api.post<LiveWorkflowChatResult>(
      `/live/${workflowOrProjectId}/chat`,
      data,
    ),

  listLiveConversations: (projectId: string) =>
    api.get<Array<ConversationItem>>(`/projects/${projectId}/workflows/live/conversations`),

  getLiveConversation: (projectId: string, conversationId: string) =>
    api.get<{
      id: string;
      name: string;
      projectId: string;
      workflowId?: string;
      workflowVersion?: string;
      workflow?: {
        id: string;
        version: string;
        note?: string | null;
      };
      messages: MessageItem[];
    }>(`/projects/${projectId}/workflows/live/conversations/${conversationId}`),
};

export interface NodeExecutionTraceItem {
  node_id: string;
  node_name: string;
  node_type: string;
  status: 'success' | 'failed';
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  selected_route?: string;
  tool_calls?: Array<{
    id: string;
    tool_name: string;
    arguments: Record<string, any>;
    result: any;
    duration_ms: number;
    status: string;
  }>;
  duration_ms: number;
  error?: string;
  started_at: string;
  finished_at: string;
}

export interface LiveWorkflowExecutionResult {
  executionId: string;
  workflowVersion: string;
  status: 'completed' | 'failed';
  response: string;
  outputs: Record<string, any>;
  state: Record<string, any>;
  stepTraces: NodeExecutionTraceItem[];
  totalDurationMs: number;
  totalTokens: number;
}

export interface LiveWorkflowChatResult {
  conversationId: string;
  userMessage: MessageItem;
  assistantMessage: MessageItem;
  reply: string;
  executionId: string;
  stepTraces: NodeExecutionTraceItem[];
  totalDurationMs: number;
  totalTokens: number;
  workflow: {
    id: string;
    version: string;
    note?: string | null;
    project?: { id: string; name: string };
  };
}

// ── Conversations & Copilot Chat API functions ──────────────────────
export interface MessageItem {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: {
    text: string;
    suggestedWorkflow?: any;
    highlights?: string[];
    needsClarification?: boolean;
    clarificationQuestions?: string[];
  };
  metadata?: any;
  model?: string;
  createdAt: string;
}

export interface ConversationItem {
  id: string;
  name: string;
  projectId: string;
  workflowId?: string;
  workflowVersion?: string;
  isLive?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  workflow?: {
    id: string;
    version: string;
    note?: string | null;
  };
  _count?: {
    messages: number;
  };
  messages?: MessageItem[];
  messagesMeta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ConversationsResponse {
  data: ConversationItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SendMessageResponse {
  userMessage: MessageItem;
  assistantMessage: MessageItem;
  suggestedWorkflow?: any;
  highlights?: string[];
  needsClarification?: boolean;
  clarificationQuestions?: string[];
}

export const conversationsApi = {
  list: (projectId: string, params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return api.get<ConversationsResponse>(
      `/projects/${projectId}/conversations${query ? `?${query}` : ''}`,
    );
  },

  get: (
    projectId: string,
    conversationId: string,
    params?: { page?: number; limit?: number },
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return api.get<ConversationItem>(
      `/projects/${projectId}/conversations/${conversationId}${query ? `?${query}` : ''}`,
    );
  },

  create: (projectId: string, data?: { name?: string }) =>
    api.post<ConversationItem>(`/projects/${projectId}/conversations`, data || {}),

  update: (
    projectId: string,
    conversationId: string,
    data: { name?: string; isActive?: boolean },
  ) =>
    api.patch<ConversationItem>(
      `/projects/${projectId}/conversations/${conversationId}`,
      data,
    ),

  delete: (projectId: string, conversationId: string) =>
    api.delete<{ success: boolean; message: string }>(
      `/projects/${projectId}/conversations/${conversationId}`,
    ),

  sendMessage: (
    projectId: string,
    conversationId: string,
    data: { message: string; currentWorkflow?: any },
  ) =>
    api.post<SendMessageResponse>(
      `/projects/${projectId}/conversations/${conversationId}/messages`,
      data,
    ),
};


