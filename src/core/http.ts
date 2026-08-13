import { ApplicationError, HttpError } from '@/core/errors';

export interface HttpRequest {
  operation: string;
  method: 'GET' | 'POST';
  url: string;
  data?: string | URLSearchParams;
  headers?: Record<string, string>;
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
    GM_xmlhttpRequest({
      method: request.method,
      url: request.url,
      data: request.data,
      headers: request.headers,
      timeout: REQUEST_TIMEOUT_MS,
      onload: (response) => {
        resolve({
          status: response.status,
          body: response.responseText,
        });
      },
      onerror: (error) => {
        reject(new ApplicationError(request.operation, `网络请求失败：${String(error.error)}`));
      },
      ontimeout: () => {
        reject(new ApplicationError(request.operation, '网络请求超时'));
      },
    });
  });

const assertSuccess = (request: HttpRequest, response: HttpResponse): HttpResponse => {
  if (response.status < 200 || response.status >= 300) {
    throw new HttpError(request.operation, response.status, response.body);
  }
  return response;
};

const isRetryable = (error: unknown): boolean =>
  !(error instanceof HttpError) || error.status === 429 || error.status >= 500;

const waitBeforeRetry = (attempt: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, RETRY_DELAY_MS * 2 ** (attempt - 1));
  });

export const requestText = async (request: HttpRequest): Promise<HttpResponse> =>
  assertSuccess(request, await send(request));

export const requestTextWithRetry = async (request: HttpRequest): Promise<HttpResponse> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return assertSuccess(request, await send(request));
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_ATTEMPTS || !isRetryable(error)) {
        throw error;
      }
      console.warn('115- 请求重试', {
        operation: request.operation,
        url: request.url,
        attempt,
        error,
      });
      await waitBeforeRetry(attempt);
    }
  }
  throw lastError;
};
