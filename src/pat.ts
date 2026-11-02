/**
 * Qoder CN token exchange and identity resolution.
 *
 * A Qoder PAT (`pt-...`) cannot authenticate API calls directly; it is
 * exchanged for a short-lived job token (`jt-...`) plus a job refresh token
 * (`jrt-...`) mirroring the official qoderclicn flow, and the user identity is
 * resolved from `/userinfo` because every COSY-signed request needs the server
 * userID. The adapter caches the exchange per PAT in process and refreshes the
 * job token through the jrt before it expires — no plaintext PAT is persisted
 * anywhere.
 *
 * @module dsh-llm-qoder/pat
 */

import { qoderExchangeUrl, qoderJobTokenRefreshUrl, qoderUserInfoUrl, type QoderCnEndpoints } from './cosy.ts'

const UA = 'dsh-llm-qoder'

/** A usable job-token session for one PAT. */
export interface QoderJobTokenSession {
  /** Short-lived job token (jt-...) used for auth + COSY signatures. */
  jobToken: string
  /** Job refresh token (jrt-...), if the exchange returned one. */
  jobRefreshToken: string
  /** Epoch ms when the job token expires. */
  expiresAt: number
}

/** Identity fields resolved from `/userinfo`. */
export interface QoderUserInfo {
  userID: string
  email: string
  name: string
}

/**
 * A token request the OpenAPI host answered with a non-2xx status. The status
 * rides along because the caller has to tell the two kinds apart: 401/403 mean
 * the PAT (or the tenant it belongs to) is unusable, while a 5xx is an outage
 * that must stay retryable. Matching on the message text cannot draw that line.
 */
export class QoderTokenError extends Error {
  /**
   * @param message - human-readable failure, already naming the operation.
   * @param status - the HTTP status the endpoint answered with.
   */
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'QoderTokenError'
  }
}

/** Exchange response shape (public CN OpenAPI). */
interface ExchangeResponse {
  token?: string
  refresh_token?: string
  created_at?: string
  expires_at?: string
  expires_in?: number
  refresh_token_expires_at?: string
  refresh_token_expires_in?: number
}

function parseExpiry(data: ExchangeResponse): number {
  if (data.expires_at) {
    const parsed = Date.parse(data.expires_at)
    if (!Number.isNaN(parsed)) return parsed
  }
  if (data.expires_in) {
    // expires_in is in milliseconds per the observed API response.
    return Date.now() + data.expires_in
  }
  return Date.now() + 24 * 60 * 60 * 1000
}

/**
 * Exchange a Qoder PAT for a short-lived job token.
 * `POST {openapi}/api/v1/jobToken/exchange { personal_token }`.
 * The exchange endpoint requires no COSY signature.
 * @param pat - the `pt-...` personal access token.
 * @param endpoints - resolved CN endpoints.
 * @param signal - optional caller cancellation.
 * @returns the job-token session.
 * @throws Error when the exchange fails or returns no job token.
 */
export async function exchangeJobToken(
  pat: string,
  endpoints: QoderCnEndpoints,
  signal?: AbortSignal,
): Promise<QoderJobTokenSession> {
  const res = await fetch(qoderExchangeUrl(endpoints), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // Uncompressed by request: a proxy dispatcher in front of the gateway can
      // deliver an encoded body without its content-encoding header.
      'Accept-Encoding': 'identity',
      'User-Agent': UA,
      'Cosy-Version': '1.0.1',
      'Cosy-ClientType': '5',
    },
    body: JSON.stringify({ personal_token: pat }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new QoderTokenError(
      `Qoder CN PAT exchange failed: ${res.status} ${res.statusText}. Response: ${text.slice(0, 200)}`,
      res.status,
    )
  }

  const data = (await res.json()) as ExchangeResponse
  if (!data.token) {
    throw new Error('Qoder CN PAT exchange returned no job token')
  }

  return {
    jobToken: data.token,
    jobRefreshToken: data.refresh_token || '',
    expiresAt: parseExpiry(data),
  }
}

/**
 * Refresh a short-lived job token using the server-issued job refresh token.
 * `POST {openapi}/api/v1/jobToken/refresh { refresh_token }`.
 * @param jobRefreshToken - the `jrt-...` refresh token.
 * @param endpoints - resolved CN endpoints.
 * @param signal - optional caller cancellation.
 * @returns the refreshed job-token session (rotated refresh token persisted).
 * @throws Error when the refresh fails or returns no job token.
 */
export async function refreshJobToken(
  jobRefreshToken: string,
  endpoints: QoderCnEndpoints,
  signal?: AbortSignal,
): Promise<QoderJobTokenSession> {
  if (jobRefreshToken.trim().length === 0) {
    throw new Error('Qoder CN job token refresh requires a non-empty refresh_token (jrt-...)')
  }

  const res = await fetch(qoderJobTokenRefreshUrl(endpoints), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // Uncompressed by request; see the exchange request above.
      'Accept-Encoding': 'identity',
      'User-Agent': UA,
      'Cosy-Version': '1.0.1',
      'Cosy-ClientType': '5',
    },
    body: JSON.stringify({ refresh_token: jobRefreshToken }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new QoderTokenError(
      `Qoder CN job token refresh failed: ${res.status} ${res.statusText}. Response: ${text.slice(0, 200)}`,
      res.status,
    )
  }

  const data = (await res.json()) as ExchangeResponse
  if (!data.token) {
    throw new Error('Qoder CN job token refresh returned no job token')
  }

  return {
    jobToken: data.token,
    jobRefreshToken: data.refresh_token || jobRefreshToken,
    expiresAt: parseExpiry(data),
  }
}

/**
 * Fetch the user profile with a job token.
 *
 * A transport failure and an unusable token are told apart here: the caller has
 * to report them differently (a retryable outage versus "check your PAT"), and
 * swallowing the error into empty fields made every network blip read as a bad
 * credential. An OK response that simply carries no id still returns empty
 * fields, because that is a real answer the caller decides about.
 *
 * @param jobToken - the short-lived job token (jt-...).
 * @param endpoints - resolved CN endpoints.
 * @param signal - optional caller cancellation.
 * @returns the identity, with empty fields for anything the server omitted.
 * @throws QoderTokenError when the endpoint answers a non-2xx status.
 */
export async function fetchUserInfo(
  jobToken: string,
  endpoints: QoderCnEndpoints,
  signal?: AbortSignal,
): Promise<QoderUserInfo> {
  const res = await fetch(qoderUserInfoUrl(endpoints), {
    headers: {
      Authorization: `Bearer ${jobToken}`,
      Accept: 'application/json',
      'Accept-Encoding': 'identity',
      'User-Agent': UA,
      'Cosy-Version': '1.0.1',
      'Cosy-ClientType': '5',
    },
    signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new QoderTokenError(
      `Qoder CN identity lookup failed: ${res.status} ${res.statusText}. Response: ${text.slice(0, 200)}`,
      res.status,
    )
  }
  const info = (await res.json()) as { id?: string; email?: string; name?: string; username?: string }
  return {
    userID: info.id || '',
    email: info.email || '',
    name: info.name || info.username || '',
  }
}
