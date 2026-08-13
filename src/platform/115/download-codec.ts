import { MD5 } from 'crypto-es';
import { ApplicationError } from '@/core/errors';

const KEY_TABLE = [
  240, 229, 105, 174, 191, 220, 191, 138, 26, 69, 232, 190, 125, 166, 115, 184, 222, 143, 231, 196,
  69, 218, 134, 196, 155, 100, 139, 20, 106, 180, 241, 170, 56, 1, 53, 158, 38, 105, 44, 134, 0,
  107, 79, 165, 54, 52, 98, 166, 42, 150, 104, 24, 242, 74, 253, 189, 107, 151, 143, 77, 143, 137,
  19, 183, 108, 142, 147, 237, 14, 13, 72, 62, 215, 47, 136, 216, 254, 254, 126, 134, 80, 149, 79,
  209, 235, 131, 38, 52, 219, 102, 123, 156, 126, 157, 122, 129, 50, 234, 182, 51, 222, 58, 169, 89,
  52, 102, 59, 170, 186, 129, 96, 72, 185, 213, 129, 156, 248, 108, 132, 119, 255, 84, 120, 38, 95,
  190, 232, 30, 54, 159, 52, 128, 92, 69, 44, 155, 118, 213, 27, 143, 204, 195, 184, 245,
] as const;

const SHORT_KEY = [0x29, 0x23, 0x21, 0x5e] as const;
const LONG_KEY = [120, 6, 173, 76, 51, 134, 93, 24, 76, 1, 63, 70] as const;
const RSA_MODULUS = BigInt(
  '0x8686980c0f5a24c4b9d43020cd2c22703ff3f450756529058b1cf88f09b8602136477198a6e2683149659bd122c33592fdb5ad47944ad1ea4d36c6b172aad6338c3bb6ac6227502d010993ac967d1aef00f0c8e038de2e4d3bc2ec368af2e9f10a6f1eda4f7262f136420c07c331b871bf139f74f3010e3c4fe57df3afb71683',
);
const RSA_EXPONENT = 0x10001n;
const UTF8_DECODER = new TextDecoder();

export interface EncodedDownloadRequest {
  data: string;
  key: number[];
}

const stringToBytes = (value: string): number[] =>
  Array.from(value, (character) => character.charCodeAt(0));

const bytesToString = (bytes: readonly number[]): string => String.fromCharCode(...bytes);

const xor = (source: readonly number[], key: readonly number[]): number[] => {
  const offset = source.length % 4;
  return source.map((value, index) => {
    const keyIndex = index < offset ? index : index - offset;
    const keyValue = key[keyIndex % key.length];
    if (keyValue === undefined) {
      throw new ApplicationError('生成下载地址', '115 下载编码密钥为空');
    }
    return value ^ keyValue;
  });
};

const deriveKey = (length: 4 | 12, key: readonly number[] | null): number[] => {
  if (key === null) {
    return [...(length === 12 ? LONG_KEY : SHORT_KEY)];
  }
  return Array.from({ length }, (_, index) => {
    const value = key[index];
    const left = KEY_TABLE[length * index];
    const right = KEY_TABLE[length * (length - 1 - index)];
    if (value === undefined || left === undefined || right === undefined) {
      throw new ApplicationError('生成下载地址', '115 下载编码密钥长度无效');
    }
    return ((value + left) & 0xff) ^ right;
  });
};

const symmetricEncode = (source: number[], key: number[]): number[] => {
  const first = xor(source, deriveKey(4, key));
  return xor(first.reverse(), deriveKey(12, null));
};

const symmetricDecode = (source: number[], key: number[], salt: number[]): number[] => {
  const first = xor(source, deriveKey(12, salt));
  return xor(first.reverse(), deriveKey(4, key));
};

const bytesToHex = (bytes: readonly number[]): string =>
  bytes.map((value) => value.toString(16).padStart(2, '0')).join('');

const hexToString = (hex: string): string => {
  const bytes = hex.match(/.{2}/g);
  if (!bytes) {
    return '';
  }
  return bytesToString(bytes.map((value) => Number.parseInt(value, 16)));
};

const modularPower = (baseValue: bigint, exponentValue: bigint, modulus: bigint): bigint => {
  let base = baseValue % modulus;
  let exponent = exponentValue;
  let result = 1n;
  while (exponent > 0n) {
    if (exponent % 2n === 1n) {
      result = (result * base) % modulus;
    }
    exponent >>= 1n;
    base = (base * base) % modulus;
  }
  return result;
};

const pad = (text: string): bigint => {
  const size = 128;
  if (text.length + 11 > size) {
    throw new ApplicationError('生成下载地址', '115 下载编码块长度超限');
  }
  const bytes = new Array<number>(size).fill(0xff);
  bytes[0] = 0;
  bytes[1] = 2;
  const separator = size - text.length - 1;
  bytes[separator] = 0;
  for (let index = 0; index < text.length; index += 1) {
    bytes[separator + 1 + index] = text.charCodeAt(index);
  }
  return BigInt(`0x${bytesToHex(bytes)}`);
};

const unpad = (value: bigint): string => {
  const hex = value.toString(16).padStart(256, '0');
  const decoded = hexToString(hex);
  const separator = decoded.indexOf('\0', 2);
  if (separator < 0) {
    throw new ApplicationError('解析下载地址', '115 下载响应缺少 RSA 分隔符');
  }
  return decoded.slice(separator + 1);
};

const rsaEncode = (source: number[]): string => {
  const blockSize = 117;
  let encrypted = '';
  for (let offset = 0; offset < source.length; offset += blockSize) {
    const block = bytesToString(source.slice(offset, offset + blockSize));
    encrypted += modularPower(pad(block), RSA_EXPONENT, RSA_MODULUS)
      .toString(16)
      .padStart(256, '0');
  }
  return window.btoa(hexToString(encrypted));
};

const rsaDecode = (source: number[]): number[] => {
  const blockSize = 128;
  let decoded = '';
  for (let offset = 0; offset < source.length; offset += blockSize) {
    const block = source.slice(offset, offset + blockSize);
    decoded += unpad(modularPower(BigInt(`0x${bytesToHex(block)}`), RSA_EXPONENT, RSA_MODULUS));
  }
  return stringToBytes(decoded);
};

export const encodeDownloadRequest = (
  pickCode: string,
  timestamp: number,
): EncodedDownloadRequest => {
  const key = stringToBytes(MD5(`!@###@#${timestamp}DFDR@#@#`).toString());
  const payload = stringToBytes(JSON.stringify({ pickcode: pickCode }));
  const encoded = key.slice(0, 16).concat(symmetricEncode(payload, key));
  return {
    data: rsaEncode(encoded),
    key,
  };
};

export const decodeDownloadResponse = (source: string, key: number[]): string => {
  const decoded = rsaDecode(stringToBytes(window.atob(source)));
  const payload = symmetricDecode(decoded.slice(16), key, decoded.slice(0, 16));
  return UTF8_DECODER.decode(Uint8Array.from(payload));
};
