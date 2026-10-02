const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ApiFetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

export class ApiClientError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;

  constructor(message: string, code = 'API_ERROR', statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function apiFetch<T>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const { params, headers, ...rest } = options;

  let url = `${API_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const res = await fetch(url, {
    credentials: 'include', // Ensures HTTP-only cookies are automatically sent & received
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    ...rest
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const errMessage = json?.error?.message || res.statusText || 'Request failed';
    const errCode = json?.error?.code || 'HTTP_ERROR';
    throw new ApiClientError(errMessage, errCode, res.status, json?.error?.details);
  }

  return (json?.data !== undefined ? json.data : json) as T;
}
