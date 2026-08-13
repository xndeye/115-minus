import { ApplicationError } from '@/core/errors';
import { requestTextWithRetry } from '@/core/http';
import type { DownloadLink } from '@/platform/115/download-api';

export interface IdmConfig {
  clientId: string;
}

export const validateIdmClientId = (value: string): void => {
  if (!/^\d+$/.test(value)) {
    throw new TypeError(`IDM 客户标识必须是数字：${value || '<空>'}`);
  }
};

const TEXT_ENCODER = new TextEncoder();
let nextSequence = 1;
let requestQueue: Promise<void> = Promise.resolve();

const encodeField = (key: number, value: string | number): string => {
  const text = String(value);
  return `${key}=${TEXT_ENCODER.encode(text).byteLength}:${text}`;
};

const readExtension = (filename: string): string => {
  const separator = filename.lastIndexOf('.');
  return separator > 0 && separator < filename.length - 1
    ? filename.slice(separator + 1).toUpperCase()
    : '';
};

const createRequestBody = (sequence: number, link: DownloadLink, size: number): string => {
  const fields = [
    encodeField(4, readExtension(link.name)),
    encodeField(6, link.url),
    encodeField(7, window.location.origin),
    encodeField(11, `User-Agent: ${navigator.userAgent}\n`),
    encodeField(100, link.name),
    encodeField(122, 4),
  ];
  return `MSG#${sequence}#13#1#10241:${sequence + 1000}:0:${Date.now()}:0:1:2:${size}:0,${fields.join(',')};`;
};

const send = async (config: IdmConfig, link: DownloadLink, size: number): Promise<void> => {
  const operation = `推送“${link.name}”到 IDM`;
  validateIdmClientId(config.clientId);
  const sequence = nextSequence;
  const response = await requestTextWithRetry({
    operation,
    method: 'POST',
    url: `http://127.0.0.1:1001/client/${config.clientId}?seq=${sequence}`,
    data: createRequestBody(sequence, link, size),
  });
  if (!response.body.endsWith(`${sequence}:3;`)) {
    throw new ApplicationError(operation, `IDM 扩展返回无法识别的响应：${response.body || '<空>'}`);
  }
  nextSequence += 1;
};

export const addIdmDownload = (
  config: IdmConfig,
  link: DownloadLink,
  size: number,
): Promise<void> => {
  const task = requestQueue.then(() => send(config, link, size));
  requestQueue = task.catch(() => undefined);
  return task;
};
