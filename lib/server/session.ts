import { NextRequest, NextResponse } from "next/server";

import { createSessionFromIdToken, refreshAuthSession, type AuthSession } from "@/lib/server/firebase-auth";
import { getAdminFirestore } from "@/lib/server/firebase-admin";

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
  let idToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!idToken) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      idToken = authHeader.substring(7).trim();
    }
  }

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

export async function getUserRoleServer(uid: string, email?: string, name?: string): Promise<string> {
  const db = getAdminFirestore();
  const userRef = db.collection("users").doc(uid);
  try {
    const doc = await userRef.get();
    if (doc.exists) {
      return doc.data()?.role || "editor";
    }
    
    // Auto-create document if it doesn't exist to ensure consistency.
    // If no other admin exists in the users collection, assign the admin role to this first user.
    const adminsSnapshot = await db.collection("users").where("role", "==", "admin").limit(1).get();
    const role = adminsSnapshot.empty ? "admin" : "editor";
    await userRef.set({
      uid,
      name: name || email || "User",
      email: email || "",
      role,
      createdAt: new Date().toISOString(),
    });
    return role;
  } catch (error) {
    console.error("Error fetching/initializing user role:", error);
    return "editor";
  }
}

export async function requireWriteAccess(request: NextRequest) {
  const sessionState = await requireSession(request);
  if (!sessionState) return null;

  const role = await getUserRoleServer(
    sessionState.session.user.uid,
    sessionState.session.user.email,
    sessionState.session.user.displayName
  );
  if (role === "viewer") {
    return null;
  }

  return sessionState;
}

export async function requireAdminSession(request: NextRequest) {
  const sessionState = await requireSession(request);
  if (!sessionState) return null;

  const role = await getUserRoleServer(
    sessionState.session.user.uid,
    sessionState.session.user.email,
    sessionState.session.user.displayName
  );
  if (role !== "admin") {
    return null;
  }

  return sessionState;
}

export async function assertAdminSession(request: NextRequest) {
  // Check for server-to-server integration key
  const expectedKey = process.env.RACE_CMS_INTEGRATION_KEY || process.env.CMS_INTEGRATION_KEY;
  if (expectedKey) {
    const authHeader = request.headers.get("authorization");
    const headerKey = request.headers.get("x-cms-api-key") || 
      (authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null);

    if (headerKey && headerKey === expectedKey) {
      return {
        ok: true as const,
        sessionState: null,
        role: "admin",
        user: {
          uid: "system_integration",
          email: "integration@raceindia.org",
          displayName: "Race Integration Service",
        },
      };
    }
  }

  const sessionState = await requireSession(request);
  if (!sessionState) {
    return {
      ok: false as const,
      status: 401 as const,
      message: "Authentication required. Please sign in to continue.",
      sessionState: null,
    };
  }

  const role = await getUserRoleServer(
    sessionState.session.user.uid,
    sessionState.session.user.email,
    sessionState.session.user.displayName
  );

  if (role !== "admin") {
    return {
      ok: false as const,
      status: 403 as const,
      message: "Permission denied. Administrator privileges required.",
      sessionState: null,
    };
  }

  return {
    ok: true as const,
    sessionState,
    role,
    user: sessionState.session.user,
  };
}
