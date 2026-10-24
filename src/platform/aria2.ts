import { ApplicationError, errorMessage } from '@/core/errors';
import { requestTextWithRetry } from '@/core/http';
import {
  isObject,
  optionalString,
  parseObject,
  requireObject,
  requireString,
  type JsonObject,
} from '@/core/validation';
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

class Aria2RpcError extends ApplicationError {
  constructor(operation: string, error: JsonObject) {
    const code = typeof error.code === 'number' ? `（代码 ${error.code}）` : '';
    super(operation, `${optionalString(error, 'message') || 'aria2 返回未知错误'}${code}`);
    this.name = 'Aria2RpcError';
  }
}

const pendingGids = new Map<string, string>();

const callAria2 = async (
  config: Aria2Config,
  operation: string,
  method: 'aria2.addUri' | 'aria2.tellStatus',
  params: unknown[],
): Promise<JsonObject> => {
  const response = await requestTextWithRetry({
    operation,
    method: 'POST',
    url: config.rpcUrl,
    data: JSON.stringify({
      id: crypto.randomUUID(),
      jsonrpc: '2.0',
      method,
      params: config.secret ? [`token:${config.secret}`, ...params] : params,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const json = parseObject(response.body, operation);
  if (json.error !== undefined) {
    if (!isObject(json.error)) {
      throw new ApplicationError(operation, 'aria2 返回的 error 字段不是对象');
    }
    throw new Aria2RpcError(operation, json.error);
  }
  return json;
};

export const addAria2Uri = async (config: Aria2Config, link: DownloadLink): Promise<string> => {
  const operation = `推送“${link.name}”到 aria2`;
  validateAria2RpcUrl(config.rpcUrl);
  const key = JSON.stringify([config.rpcUrl, link.pickCode]);
  const gid = pendingGids.get(key) ?? crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  pendingGids.set(key, gid);
  try {
    // 同一次推送沿用固定 GID，响应丢失后的重试不会重复创建任务。
    const json = await callAria2(config, operation, 'aria2.addUri', [
      [link.url],
      { gid, out: link.name, 'user-agent': navigator.userAgent },
    ]);
    if (requireString(json, 'result', operation) !== gid) {
      throw new ApplicationError(operation, `aria2 返回的 GID 与请求不一致，预期 ${gid}`);
    }
  } catch (error) {
    console.warn('115- 确认 aria2 任务创建结果', { gid, pickCode: link.pickCode, error });
    try {
      const json = await callAria2(config, operation, 'aria2.tellStatus', [gid, ['gid']]);
      const result = requireObject(json, 'result', operation);
      if (requireString(result, 'gid', operation) !== gid) {
        throw new ApplicationError(operation, `aria2 查询返回了其他任务，预期 GID ${gid}`);
      }
    } catch (statusError) {
      if (error instanceof Aria2RpcError && statusError instanceof Aria2RpcError) {
        throw error;
      }
      throw new ApplicationError(
        operation,
        `无法确认任务创建结果，重试将沿用 GID ${gid}。提交错误：${errorMessage(error)}；查询错误：${errorMessage(statusError)}`,
        statusError,
      );
    }
  }
  pendingGids.delete(key);
  return gid;
};
