// ─── Pagination ──────────────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

// ─── Standard API response shapes ────────────────────────────────────────────
// requestId is injected automatically by loggerPlugin (onSend hook).
// Controllers only need to return { data } — the plugin handles the rest.

export interface ApiResponse<T> {
  data: T;
  requestId: string;
  meta?: Pagination;
}

export interface ApiErrorResponse {
  error: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

// ─── Internal ────────────────────────────────────────────────────────────────

export interface RequestContext {
  requestId: string;
  userId?: string;
}
