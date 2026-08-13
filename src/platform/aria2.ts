import { ApplicationError } from '@/core/errors';
import { requestTextWithRetry } from '@/core/http';
import { isObject, optionalString, parseObject, requireString } from '@/core/validation';
import type { DownloadLink } from '@/platform/115/download-api';

export interface Aria2Config {
  rpcUrl: string;
  secret: string;
}

export const validateAria2RpcUrl = (value: string): void => {
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new TypeError(`aria2 RPC 地址无效：${value}`, { cause });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError(`aria2 RPC 地址仅支持 HTTP 或 HTTPS：${value}`);
  }
};

interface Aria2Error {
  code: number | null;
  message: string;
}

const readAria2Error = (value: unknown): Aria2Error | null => {
  if (!isObject(value)) {
    return null;
  }
  return {
    code: typeof value.code === 'number' ? value.code : null,
    message: optionalString(value, 'message') || 'aria2 返回未知错误',
  };
};

export const addAria2Uri = async (config: Aria2Config, link: DownloadLink): Promise<string> => {
  const operation = `推送“${link.name}”到 aria2`;
  validateAria2RpcUrl(config.rpcUrl);
  const params: unknown[] = [
    [link.url],
    {
      out: link.name,
      'user-agent': navigator.userAgent,
    },
  ];
  if (config.secret) {
    params.unshift(`token:${config.secret}`);
  }
  const response = await requestTextWithRetry({
    operation,
    method: 'POST',
    url: config.rpcUrl,
    data: JSON.stringify({
      id: link.pickCode,
      jsonrpc: '2.0',
      method: 'aria2.addUri',
      params,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const json = parseObject(response.body, operation);
  const rpcError = readAria2Error(json.error);
  if (rpcError) {
    const code = rpcError.code === null ? '' : `（代码 ${rpcError.code}）`;
    throw new ApplicationError(operation, `${rpcError.message}${code}`);
  }
  return requireString(json, 'result', operation);
};
