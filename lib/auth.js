import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getAdminUser() {
  return process.env.ADMIN_USER || "";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || getAdminPassword();
}

function signPayload(payload) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAuthConfigured() {
  return Boolean(getAdminUser() && getAdminPassword());
}

export function validateCredentials(login, password) {
  if (!isAuthConfigured()) {
    return { ok: false, reason: "AUTH_NOT_CONFIGURED" };
  }

  if (login === getAdminUser() && password === getAdminPassword()) {
    return { ok: true, user: login };
  }

  return { ok: false, reason: "INVALID_CREDENTIALS" };
}

export function createSessionToken(user) {
  const now = Date.now();
  const payload = base64UrlEncode(JSON.stringify({
    sub: user,
    iat: now,
    exp: now + TOKEN_TTL_MS
  }));
  return `${payload}.${signPayload(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || !isAuthConfigured()) {
    return { ok: false, reason: "AUTH_REQUIRED" };
  }

  const parts = String(token).split(".");
  if (parts.length !== 2) {
    return { ok: false, reason: "INVALID_TOKEN" };
  }

  const expectedSignature = signPayload(parts[0]);
  if (!safeEqual(parts[1], expectedSignature)) {
    return { ok: false, reason: "INVALID_TOKEN" };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(parts[0]));
    if (!payload.exp || payload.exp < Date.now()) {
      return { ok: false, reason: "TOKEN_EXPIRED" };
    }
    return { ok: true, user: payload.sub };
  } catch {
    return { ok: false, reason: "INVALID_TOKEN" };
  }
}

export function readBearerToken(request) {
  const authorization = request.headers.authorization || request.headers.Authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}
