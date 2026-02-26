const BASE_URL = import.meta.env.VITE_API_URL ?? '';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    throw new ApiError(res.status, `Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      signal,
    }),
};

export { ApiError };
