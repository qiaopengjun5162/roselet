export function withoutExplicitContentLength(init?: RequestInit): RequestInit | undefined {
  if (!init?.headers) return init;
  const headers = new Headers(init.headers);
  headers.delete("content-length");
  return { ...init, headers };
}

export function decodeBase64JsonHeader(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  } catch {
    return "invalid_base64_json";
  }
}
