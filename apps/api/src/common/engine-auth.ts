import * as crypto from 'crypto';

export interface EngineAuthHeaders {
  'Content-Type': string;
  'X-Engine-Timestamp': string;
  'X-Engine-Signature': string;
  Authorization: string;
}

/**
 * Returns HMAC-SHA256 authenticated request headers for calling Quickgent Engine.
 * Matches engine's Python HMAC verification:
 * payload: `${timestamp}:${method.toUpperCase()}:${normalized_path}`
 */
export function getEngineAuthHeaders(
  method: string,
  path: string,
): EngineAuthHeaders {
  const secret =
    process.env.INTERNAL_ENGINE_SECRET ||
    process.env.ENGINE_API_SECRET ||
    'quickgent_engine_internal_secret_key_2026';

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const normalizedPath =
    path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  const payload = `${timestamp}:${method.toUpperCase()}:${normalizedPath}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return {
    'Content-Type': 'application/json',
    'X-Engine-Timestamp': timestamp,
    'X-Engine-Signature': signature,
    Authorization: `Bearer ${secret}`,
  };
}

