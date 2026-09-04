import {
  CONTRACT_VERSION,
  ERROR_COPY,
  isErrorCode,
  RETRYABLE_ERROR_CODES,
  type BillOfMaterialsResponse,
  type CatalogResponse,
  type Confirmation,
  type ErrorCode,
  type Operation,
  type Product,
  type ProductCategory,
  type Proposal,
  type ProtectedAction,
  type ProtectedActionResponse,
  type Receipt,
  type RoomState,
  type RoomStateResponse,
  type RoomType,
} from '@handshake/contracts';

/** Custom typed error thrown when an API request fails. */
export class HandshakeApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly requestId?: string | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    requestId?: string | undefined,
    retryable?: boolean | undefined,
  ) {
    super(message);
    this.name = 'HandshakeApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryable = retryable ?? RETRYABLE_ERROR_CODES.includes(code);
    Object.setPrototypeOf(this, HandshakeApiError.prototype);
  }
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  contractVersion: string;
}

export interface CreateSessionOptions {
  roomType?: RoomType | undefined;
  budgetCents?: number | undefined;
  widthIn?: number | undefined;
  lengthIn?: number | undefined;
}

export interface CreateSessionResponse {
  sessionId: string;
  capability: string;
  contractVersion: string;
}

export interface ProposeBody {
  expectedVersion: number;
  operations: Operation[];
  rationale: string;
  idempotencyKey: string;
}

export interface DecideBody {
  proposalId: string;
  proposalHash: string;
  decision?: 'approved' | 'rejected' | undefined;
  outcome?: 'approve' | 'reject' | undefined;
}

export interface ApplyBody {
  proposalId: string;
  proposalHash: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface EditBody {
  expectedVersion: number;
  operations: Operation[];
}

export interface ConfirmationBody {
  action: ProtectedAction;
  payload: Record<string, string>;
}

export interface ConfirmationResponse {
  confirmation: Confirmation;
  proof: string;
}

export interface ProtectedActionBody {
  action: ProtectedAction;
  payload: Record<string, string>;
  proof?: string | undefined;
  confirmationId?: string | undefined;
  idempotencyKey: string;
}

export interface HandshakeApiClientOptions {
  baseUrl?: string | undefined;
  fetch?: typeof fetch | undefined;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | undefined;
  body?: unknown;
  capability?: string | null | undefined;
  headers?: Record<string, string> | undefined;
}

/**
 * High-integrity typed client for the Handshake Cloudflare Worker backend.
 */
export class HandshakeApiClient {
  readonly baseUrl: string;
  private readonly customFetch?: typeof fetch | undefined;

  constructor(options?: string | HandshakeApiClientOptions | undefined) {
    let rawUrl = '';
    if (typeof options === 'string') {
      rawUrl = options;
    } else if (options && typeof options === 'object') {
      rawUrl = options.baseUrl ?? '';
      this.customFetch = options.fetch;
    } else if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) {
      rawUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    }

    // Strip trailing slashes to guarantee exact path matches with the worker's strict regex router
    this.baseUrl = rawUrl.replace(/\/+$/, '');
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, capability, headers = {} } = options;
    const url = `${this.baseUrl}${path}`;

    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...headers,
    };

    if (body !== undefined) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    if (capability) {
      requestHeaders['x-handshake-capability'] = capability;
    }

    const fetchFn =
      this.customFetch ?? (typeof window !== 'undefined' ? window.fetch.bind(window) : fetch);

    let response: Response;
    try {
      const init: RequestInit = {
        method,
        headers: requestHeaders,
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }
      response = await fetchFn(url, init);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network request failed';
      throw new HandshakeApiError('INVALID_INPUT', message, 0);
    }

    let json: any = null;
    const text = await response.text();
    if (text.length > 0) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (!response.ok || (json && json.ok === false)) {
      let code: ErrorCode = 'INVALID_INPUT';
      let message = '';
      let retryable = false;
      let requestId: string | undefined;

      if (json && typeof json === 'object') {
        requestId = typeof json.requestId === 'string' ? json.requestId : undefined;
        if (json.error && typeof json.error === 'object') {
          if (isErrorCode(json.error.code)) {
            code = json.error.code;
          }
          if (typeof json.error.message === 'string') {
            message = json.error.message;
          }
          if (typeof json.error.retryable === 'boolean') {
            retryable = json.error.retryable;
          }
        }
      }

      if (!message) {
        message = ERROR_COPY[code] ?? response.statusText ?? 'An API error occurred';
      }

      throw new HandshakeApiError(
        code,
        message,
        response.status,
        requestId,
        retryable || RETRYABLE_ERROR_CODES.includes(code),
      );
    }

    // Worker returns `{ ok: true, data: T }` for standard endpoints, or direct JSON like `/healthz`
    if (json && typeof json === 'object' && 'data' in json && json.data !== undefined) {
      return json.data as T;
    }

    return json as T;
  }

  /** GET /healthz - Public liveness check */
  async healthz(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/healthz', { method: 'GET' });
  }

  /** GET /api/v1/catalog - Public fixture catalog */
  async getCatalog(
    roomType?: RoomType | undefined,
    category?: ProductCategory | undefined,
  ): Promise<CatalogResponse> {
    const params = new URLSearchParams();
    if (roomType) params.set('roomType', roomType);
    if (category) params.set('category', category);
    const query = params.toString();
    const path = `/api/v1/catalog${query ? `?${query}` : ''}`;
    return this.request<CatalogResponse>(path, { method: 'GET' });
  }

  /** POST /api/v1/sessions - Initialize a new design session */
  async createSession(options?: CreateSessionOptions | undefined): Promise<CreateSessionResponse> {
    return this.request<CreateSessionResponse>('/api/v1/sessions', {
      method: 'POST',
      body: options ?? {},
    });
  }

  /** GET /api/v1/sessions/:id/state - Retrieve committed room state and design evaluation */
  async getState(
    sessionId: string,
    capability?: string | null | undefined,
  ): Promise<RoomStateResponse> {
    return this.request<RoomStateResponse>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/state`,
      {
        method: 'GET',
        capability,
      },
    );
  }

  /** POST /api/v1/sessions/:id/proposals - Propose atomic changes (non-mutating preview) */
  async propose(
    sessionId: string,
    capability: string | null | undefined,
    body: ProposeBody,
  ): Promise<{ proposal: Proposal; state: RoomState }> {
    return this.request<{ proposal: Proposal; state: RoomState }>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/proposals`,
      {
        method: 'POST',
        capability,
        body,
      },
    );
  }

  /** POST /api/v1/sessions/:id/decisions - Human UI approval or rejection of a proposal */
  async decide(
    sessionId: string,
    capability: string | null | undefined,
    body: DecideBody,
  ): Promise<{ proposal: Proposal }> {
    const outcome = body.outcome ?? (body.decision === 'approved' ? 'approve' : 'reject');
    return this.request<{ proposal: Proposal }>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/decisions`,
      {
        method: 'POST',
        capability,
        body: {
          proposalId: body.proposalId,
          proposalHash: body.proposalHash,
          outcome,
        },
      },
    );
  }

  /** POST /api/v1/sessions/:id/apply - Apply an approved proposal to advance committed version */
  async apply(
    sessionId: string,
    capability: string | null | undefined,
    body: ApplyBody,
  ): Promise<{ proposal: Proposal; state: RoomState }> {
    return this.request<{ proposal: Proposal; state: RoomState }>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/apply`,
      {
        method: 'POST',
        capability,
        body,
      },
    );
  }

  /** POST /api/v1/sessions/:id/edits - Direct human UI manual edit */
  async edit(
    sessionId: string,
    capability: string | null | undefined,
    body: EditBody,
  ): Promise<{ state: RoomState }> {
    return this.request<{ state: RoomState }>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/edits`,
      {
        method: 'POST',
        capability,
        body,
      },
    );
  }

  /** POST /api/v1/sessions/:id/confirmations - Request human confirmation token for protected action */
  async requestConfirmation(
    sessionId: string,
    capability: string | null | undefined,
    body: ConfirmationBody,
  ): Promise<ConfirmationResponse> {
    return this.request<ConfirmationResponse>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/confirmations`,
      {
        method: 'POST',
        capability,
        body,
      },
    );
  }

  /** POST /api/v1/sessions/:id/protected-actions - Execute action using single-use confirmation proof */
  async executeProtectedAction(
    sessionId: string,
    capability: string | null | undefined,
    body: ProtectedActionBody,
  ): Promise<ProtectedActionResponse> {
    return this.request<ProtectedActionResponse>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/protected-actions`,
      {
        method: 'POST',
        capability,
        body,
      },
    );
  }

  /** GET /api/v1/sessions/:id/receipt - Retrieve public cryptographic audit receipt */
  async getReceipt(
    sessionId: string,
    capability?: string | null | undefined,
  ): Promise<{ receipt: Receipt }> {
    return this.request<{ receipt: Receipt }>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/receipt`,
      {
        method: 'GET',
        capability,
      },
    );
  }

  /** GET /api/v1/sessions/:id/bom - Retrieve itemized Bill of Materials */
  async getBillOfMaterials(
    sessionId: string,
    capability?: string | null | undefined,
  ): Promise<BillOfMaterialsResponse> {
    return this.request<BillOfMaterialsResponse>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/bom`,
      {
        method: 'GET',
        capability,
      },
    );
  }
}

/** Default singleton instance using relative path proxy rewrites. */
export const defaultApiClient = new HandshakeApiClient();
export const apiClient = defaultApiClient;
