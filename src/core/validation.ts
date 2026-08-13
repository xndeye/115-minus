import { ApplicationError } from '@/core/errors';

export type JsonObject = Record<string, unknown>;

export const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseObject = (text: string, operation: string): JsonObject => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new ApplicationError(operation, `响应不是有效 JSON：${text || '<空>'}`, error);
  }
  if (!isObject(value)) {
    throw new ApplicationError(operation, '响应 JSON 不是对象');
  }
  return value;
};

export const requireString = (object: JsonObject, key: string, operation: string): string => {
  const value = object[key];
  if (typeof value !== 'string' || !value) {
    throw new ApplicationError(operation, `响应字段 ${key} 不是非空字符串`);
  }
  return value;
};

export const requireIdentifier = (object: JsonObject, key: string, operation: string): string => {
  const value = object[key];
  if (typeof value === 'string' && value) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  throw new ApplicationError(operation, `响应字段 ${key} 不是有效标识符`);
};

export const requireNumber = (object: JsonObject, key: string, operation: string): number => {
  const value = object[key];
  const number = typeof value === 'string' && value !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new ApplicationError(operation, `响应字段 ${key} 不是有效数字`);
  }
  return number;
};

export const optionalString = (object: JsonObject, key: string): string => {
  const value = object[key];
  return typeof value === 'string' ? value : '';
};

export const requireArray = (object: JsonObject, key: string, operation: string): unknown[] => {
  const value = object[key];
  if (!Array.isArray(value)) {
    throw new ApplicationError(operation, `响应字段 ${key} 不是数组`);
  }
  return value;
};

export const requireObject = (object: JsonObject, key: string, operation: string): JsonObject => {
  const value = object[key];
  if (!isObject(value)) {
    throw new ApplicationError(operation, `响应字段 ${key} 不是对象`);
  }
  return value;
};
