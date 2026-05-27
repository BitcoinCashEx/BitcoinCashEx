import type http from "node:http";

export const demoApiMaxBodyBytes = 4_096;
export const demoApiMaxIntegerDigits = 18;

const integerAmountPattern = /^[0-9]+$/;

export class DemoHttpRequestError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "DemoHttpRequestError";
    this.statusCode = statusCode;
  }
}

const singleHeaderValue = (name: string, value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    throw new DemoHttpRequestError(`${name} must not be repeated.`, 400);
  }
  return value;
};

const contentTypeIsJson = (contentType: string | string[] | undefined): boolean => {
  const value = singleHeaderValue("Content-Type", contentType);
  if (value === undefined) return false;
  return value.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
};

const parseContentLength = (value: string | string[] | undefined): number | undefined => {
  const text = singleHeaderValue("Content-Length", value);
  if (text === undefined) return undefined;
  if (!/^[0-9]+$/.test(text)) {
    throw new DemoHttpRequestError("Content-Length must be a non-negative integer.", 400);
  }
  return Number.parseInt(text, 10);
};

const readLimitedRequestBody = async (
  request: http.IncomingMessage,
  maxBytes = demoApiMaxBodyBytes
): Promise<string> =>
  new Promise((resolve, reject) => {
    const contentLength = parseContentLength(request.headers["content-length"]);
    if (contentLength !== undefined && contentLength > maxBytes) {
      request.resume();
      reject(new DemoHttpRequestError(`Request body must be ${maxBytes} bytes or less.`, 413));
      return;
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    request.on("data", (chunk: Buffer) => {
      if (settled) return;
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        fail(new DemoHttpRequestError(`Request body must be ${maxBytes} bytes or less.`, 413));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", fail);
  });

export const parseDemoJsonBodyText = (text: string): Record<string, unknown> => {
  if (text.trim() === "") return {};

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new DemoHttpRequestError("Request body must be valid JSON.", 400);
  }

  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new DemoHttpRequestError("Request body must be a JSON object.", 400);
  }
  return value as Record<string, unknown>;
};

export const parseDemoJsonBody = async (request: http.IncomingMessage): Promise<Record<string, unknown>> => {
  const text = await readLimitedRequestBody(request);
  if (text.trim() !== "" && !contentTypeIsJson(request.headers["content-type"])) {
    throw new DemoHttpRequestError("Content-Type must be application/json.", 415);
  }
  return parseDemoJsonBodyText(text);
};

export const positiveBigintBody = (
  body: Record<string, unknown>,
  key: string,
  maxDigits = demoApiMaxIntegerDigits
): bigint => {
  const value = body[key];
  if (typeof value !== "string" || !integerAmountPattern.test(value)) {
    throw new DemoHttpRequestError(`${key} must be an integer string.`, 400);
  }
  if (value.length > maxDigits) {
    throw new DemoHttpRequestError(`${key} must be ${maxDigits} digits or fewer.`, 400);
  }

  const parsed = BigInt(value);
  if (parsed <= 0n) {
    throw new DemoHttpRequestError(`${key} must be greater than zero.`, 400);
  }
  return parsed;
};
