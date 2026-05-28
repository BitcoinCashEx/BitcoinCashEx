export const defaultDemoServerPort = 3000;

export const parseDemoServerPort = (
  value: string | undefined,
  fallback = defaultDemoServerPort
): number => {
  const text = value === undefined || value === "" ? fallback.toString() : value;

  if (!/^[0-9]+$/.test(text)) {
    throw new Error("BCHEX_DEMO_PORT must be an integer from 1 to 65535.");
  }

  const port = Number.parseInt(text, 10);

  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("BCHEX_DEMO_PORT must be an integer from 1 to 65535.");
  }

  return port;
};
