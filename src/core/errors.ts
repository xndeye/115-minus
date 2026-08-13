export class ApplicationError extends Error {
  readonly originalCause: unknown;
  readonly operation: string;

  constructor(operation: string, message: string, cause?: unknown) {
    super(`${operation}：${message}`);
    this.name = 'ApplicationError';
    this.originalCause = cause;
    this.operation = operation;
  }
}

export class HttpError extends ApplicationError {
  readonly status: number;
  readonly responseBody: string;

  constructor(operation: string, status: number, responseBody: string) {
    super(operation, `请求失败，状态码 ${status}，响应内容：${responseBody || '<空>'}`);
    this.name = 'HttpError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return String(error);
};
