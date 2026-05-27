import { Readable } from "node:stream";
import type http from "node:http";
import { describe, expect, it } from "vitest";
import {
  demoApiMaxBodyBytes,
  demoApiMaxIntegerDigits,
  parseDemoEmptyJsonBody,
  parseDemoJsonBody,
  parseDemoJsonBodyText,
  positiveBigintBody
} from "../src/demo/httpValidation.js";

const requestFromBody = (
  body: string,
  headers: Record<string, string | string[] | undefined> = { "content-type": "application/json" }
): http.IncomingMessage => {
  const request = Readable.from([Buffer.from(body)]) as http.IncomingMessage;
  request.headers = {
    "content-length": Buffer.byteLength(body).toString(),
    ...headers
  } as http.IncomingHttpHeaders;
  return request;
};

describe("demo HTTP validation", () => {
  it("parses only JSON object request bodies", async () => {
    await expect(parseDemoJsonBody(requestFromBody('{"amount":"1000"}'))).resolves.toEqual({ amount: "1000" });
    expect(parseDemoJsonBodyText("")).toEqual({});

    await expect(parseDemoJsonBody(requestFromBody("[1,2,3]"))).rejects.toMatchObject({
      message: "Request body must be a JSON object.",
      statusCode: 400
    });
    expect(() => parseDemoJsonBodyText("{")).toThrow("valid JSON");
  });

  it("rejects oversized or non-json request bodies before parsing", async () => {
    await expect(
      parseDemoJsonBody(
        requestFromBody("{}", {
          "content-length": (demoApiMaxBodyBytes + 1).toString(),
          "content-type": "application/json"
        })
      )
    ).rejects.toMatchObject({ statusCode: 413 });

    await expect(parseDemoJsonBody(requestFromBody('{"amount":"1"}', { "content-type": "text/plain" }))).rejects.toMatchObject({
      message: "Content-Type must be application/json.",
      statusCode: 415
    });
  });

  it("rejects duplicate framing headers for backend-signed actions", async () => {
    await expect(
      parseDemoJsonBody(
        requestFromBody("{}", {
          "content-length": ["2", "999"],
          "content-type": "application/json"
        })
      )
    ).rejects.toMatchObject({
      message: "Content-Length must not be repeated.",
      statusCode: 400
    });

    await expect(
      parseDemoJsonBody(
        requestFromBody("{}", {
          "content-length": "2",
          "content-type": ["application/json", "text/plain"]
        })
      )
    ).rejects.toMatchObject({
      message: "Content-Type must not be repeated.",
      statusCode: 400
    });
  });

  it("rejects non-empty bodies for fixed backend-signed actions", async () => {
    await expect(parseDemoEmptyJsonBody(requestFromBody(""))).resolves.toBeUndefined();
    await expect(parseDemoEmptyJsonBody(requestFromBody("{}"))).resolves.toBeUndefined();
    await expect(parseDemoEmptyJsonBody(requestFromBody('{"amount":"1"}'))).rejects.toMatchObject({
      message: "Request body must be empty for this action.",
      statusCode: 400
    });
  });

  it("extracts positive bounded integer-string amounts for backend-signed actions", () => {
    expect(positiveBigintBody({ bchAmountInSats: "100000" }, "bchAmountInSats")).toBe(100_000n);

    expect(() => positiveBigintBody({ amount: "0" }, "amount")).toThrow("greater than zero");
    expect(() => positiveBigintBody({ amount: "-1" }, "amount")).toThrow("integer string");
    expect(() => positiveBigintBody({ amount: 1 }, "amount")).toThrow("integer string");
    expect(() => positiveBigintBody({ amount: "1.5" }, "amount")).toThrow("integer string");
    expect(() => positiveBigintBody({ amount: "1".repeat(demoApiMaxIntegerDigits + 1) }, "amount")).toThrow(
      "digits or fewer"
    );
  });
});
