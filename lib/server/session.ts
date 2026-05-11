import { NextRequest, NextResponse } from "next/server";

import { createSessionFromIdToken, refreshAuthSession, type AuthSession } from "@/lib/server/firebase-auth";

const SESSION_COOKIE_NAME = "race_cms_session";
const REFRESH_COOKIE_NAME = "race_cms_refresh";
const EXPIRES_COOKIE_NAME = "race_cms_expires";
const SESSION_COOKIE_AGE = 60 * 60 * 24 * 30;

export interface SessionState {
  session: AuthSession | null;
  refreshed: boolean;
}

export interface AuthenticatedSessionState {
  session: AuthSession;
  refreshed: boolean;
}

function buildCookieOptions(maxAge = SESSION_COOKIE_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/",
    maxAge,
  };
}

function shouldUseSecureCookies(request?: NextRequest) {
  const host = request?.headers.get("host") || "";
  const forwardedProto = request?.headers.get("x-forwarded-proto");
  const isLocalHost = host.includes("localhost") || host.includes("127.0.0.1");

  return {
    secure: process.env.NODE_ENV === "production" && !isLocalHost && forwardedProto === "https",
  };
}

export function applySessionCookies(response: NextResponse, session: AuthSession, request?: NextRequest) {
  const cookieOptions = {
    ...buildCookieOptions(),
    ...shouldUseSecureCookies(request),
  };

  response.cookies.set(SESSION_COOKIE_NAME, session.tokens.idToken, cookieOptions);
  response.cookies.set(REFRESH_COOKIE_NAME, session.tokens.refreshToken, cookieOptions);
  response.cookies.set(
    EXPIRES_COOKIE_NAME,
    String(Date.now() + session.tokens.expiresIn * 1000),
    cookieOptions
  );
  return response;
}

export function clearSessionCookies(response: NextResponse, request?: NextRequest) {
  const cookieOptions = {
    ...buildCookieOptions(0),
    ...shouldUseSecureCookies(request),
  };

  response.cookies.set(SESSION_COOKIE_NAME, "", cookieOptions);
  response.cookies.set(REFRESH_COOKIE_NAME, "", cookieOptions);
  response.cookies.set(EXPIRES_COOKIE_NAME, "", cookieOptions);
  return response;
}

export async function getSessionState(request: NextRequest): Promise<SessionState> {
  const idToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!idToken) {
    return { session: null, refreshed: false };
  }

  try {
    const session = await createSessionFromIdToken({
      idToken,
      refreshToken: refreshToken ?? "",
      expiresIn: 3600,
    });

    return { session, refreshed: false };
  } catch (error) {
    if (!refreshToken) {
      return { session: null, refreshed: false };
    }

    try {
      const session = await refreshAuthSession(refreshToken);
      return { session, refreshed: true };
    } catch {
      return { session: null, refreshed: false };
    }
  }
}

export async function requireSession(request: NextRequest): Promise<AuthenticatedSessionState | null> {
  const state = await getSessionState(request);
  if (!state.session) {
    return null;
  }
  return {
    session: state.session,
    refreshed: state.refreshed,
  };
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}
