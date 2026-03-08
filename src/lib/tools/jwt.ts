export interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

export function decodeJwt(token: string): JwtParts | null {
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const signature = parts[2];

    return { header, payload, signature };
  } catch {
    return null;
  }
}

export function formatTimestamp(value: unknown): string | null {
  if (typeof value !== "number") return null;
  if (value > 946684800 && value < 32503680000) {
    return new Date(value * 1000).toISOString();
  }
  return null;
}
