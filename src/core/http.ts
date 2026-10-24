import { ApplicationError, HttpError } from '@/core/errors';

export interface HttpRequest {
  operation: string;
  method: 'GET' | 'POST';
  url: string;
  data?: string | URLSearchParams;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface HttpResponse {
  status: number;
  body: string;
}

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 300;

const send = (request: HttpRequest): Promise<HttpResponse> =>
  new Promise((resolve, reject) => {
    const { signal } = request;
    signal?.throwIfAborted();
    const cleanup = (): void => signal?.removeEventListener('abort', abort);
    const abort = (): void => {
      handle.abort();
      reject(signal?.reason);
    };
    const handle = GM_xmlhttpRequest({
      method: request.method,
      url: request.url,
      data: request.data,
      headers: request.headers,
      timeout: REQUEST_TIMEOUT_MS,
      onload: (response) => {
        cleanup();
        resolve({
          status: response.status,
          body: response.responseText,
        });
      },
      onerror: (error) => {
        cleanup();
        reject(new ApplicationError(request.operation, `网络请求失败：${String(error.error)}`));
      },
      ontimeout: () => {
        cleanup();
        reject(new ApplicationError(request.operation, '网络请求超时'));
      },
      onabort: () => {
        cleanup();
        reject(signal?.reason ?? new DOMException('请求已取消', 'AbortError'));
      },
    });
    signal?.addEventListener('abort', abort, { once: true });
  });

const assertSuccess = (request: HttpRequest, response: HttpResponse): HttpResponse => {
  if (response.status < 200 || response.status >= 300) {
    throw new HttpError(request.operation, response.status, response.body);
  }
  return response;
};

const isRetryable = (error: unknown): boolean =>
  !(error instanceof HttpError) || error.status === 429 || error.status >= 500;

const waitBeforeRetry = (attempt: number, signal: AbortSignal | undefined): Promise<void> =>
  new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = (): void => {
      window.clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = window.setTimeout(
      () => {
        signal?.removeEventListener('abort', abort);
        resolve();
      },
      RETRY_DELAY_MS * 2 ** (attempt - 1),
    );
    signal?.addEventListener('abort', abort, { once: true });
  });

export const requestTextWithRetry = async (request: HttpRequest): Promise<HttpResponse> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return assertSuccess(request, await send(request));
    } catch (error) {
      request.signal?.throwIfAborted();
      if (attempt >= MAX_ATTEMPTS || !isRetryable(error)) {
        throw error;
      }
      console.warn('115- 请求重试', {
        operation: request.operation,
        url: request.url,
        attempt,
        error,
      });
      await waitBeforeRetry(attempt, request.signal);
    }
  }
};
