const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const IDENTITY_TOOLKIT_BASE_URL = "https://identitytoolkit.googleapis.com/v1";
const SECURE_TOKEN_BASE_URL = "https://securetoken.googleapis.com/v1/token";

interface FirebaseErrorPayload {
  error?: {
    message?: string;
  };
}

interface FirebaseLookupUser {
  localId: string;
  email?: string;
  displayName?: string;
  emailVerified?: boolean;
  photoUrl?: string;
}

interface FirebaseLookupResponse {
  users?: FirebaseLookupUser[];
}

export interface AuthTokens {
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSessionUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  photoUrl?: string;
  role?: string;
}

export interface AuthSession {
  user: AuthSessionUser;
  tokens: AuthTokens;
}

class FirebaseAuthApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function assertFirebaseApiKey() {
  if (!FIREBASE_API_KEY) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY");
  }
}

function toReadableFirebaseMessage(code: string) {
  const messages: Record<string, string> = {
    EMAIL_EXISTS: "An account with this email already exists.",
    EMAIL_NOT_FOUND: "No account was found with this email address.",
    EXPIRED_OOB_CODE: "This action link has expired. Please request a new one.",
    INVALID_EMAIL: "Please provide a valid email address.",
    INVALID_ID_TOKEN: "Your session is no longer valid. Please sign in again.",
    INVALID_OOB_CODE: "This action link is invalid or has already been used.",
    INVALID_PASSWORD: "The password you entered is incorrect.",
    MISSING_PASSWORD: "Password is required.",
    TOKEN_EXPIRED: "Your session has expired. Please sign in again.",
    USER_DISABLED: "This account has been disabled.",
    USER_NOT_FOUND: "The requested user could not be found.",
    WEAK_PASSWORD: "Password must be at least 6 characters long.",
  };

  return messages[code] ?? code.replaceAll("_", " ").toLowerCase();
}

async function parseFirebaseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T | FirebaseErrorPayload;
  if (!response.ok) {
    const code = (data as FirebaseErrorPayload).error?.message ?? "UNKNOWN_ERROR";
    throw new FirebaseAuthApiError(code, response.status, toReadableFirebaseMessage(code));
  }
  return data as T;
}

async function identityToolkitRequest<T>(path: string, body: Record<string, unknown>) {
  assertFirebaseApiKey();

  const response = await fetch(`${IDENTITY_TOOLKIT_BASE_URL}/${path}?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  return parseFirebaseResponse<T>(response);
}

async function secureTokenRequest<T>(body: URLSearchParams) {
  assertFirebaseApiKey();

  const response = await fetch(`${SECURE_TOKEN_BASE_URL}?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    cache: "no-store",
    body: body.toString(),
  });

  return parseFirebaseResponse<T>(response);
}

function normalizeSessionUser(user: FirebaseLookupUser): AuthSessionUser {
  return {
    uid: user.localId,
    email: user.email ?? "",
    displayName: user.displayName ?? user.email ?? "Admin User",
    emailVerified: Boolean(user.emailVerified),
    photoUrl: user.photoUrl,
  };
}

async function lookupByIdToken(idToken: string) {
  const response = await identityToolkitRequest<FirebaseLookupResponse>("accounts:lookup", {
    idToken,
  });

  return response.users?.[0] ?? null;
}

export async function createSessionFromIdToken(tokens: AuthTokens): Promise<AuthSession> {
  const user = await lookupByIdToken(tokens.idToken);
  if (!user) {
    throw new FirebaseAuthApiError("USER_NOT_FOUND", 404, "The requested user could not be found.");
  }

  return {
    user: normalizeSessionUser(user),
    tokens,
  };
}

export async function signInWithEmailPassword(email: string, password: string) {
  const response = await identityToolkitRequest<{
    idToken: string;
    refreshToken: string;
    expiresIn: string;
  }>("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });

  return createSessionFromIdToken({
    idToken: response.idToken,
    refreshToken: response.refreshToken,
    expiresIn: Number(response.expiresIn),
  });
}

export async function registerWithEmailPassword(name: string, email: string, password: string) {
  const signUpResponse = await identityToolkitRequest<{
    idToken: string;
    refreshToken: string;
    expiresIn: string;
  }>("accounts:signUp", {
    email,
    password,
    returnSecureToken: true,
  });

  const profileResponse = await identityToolkitRequest<{
    idToken?: string;
    refreshToken?: string;
    expiresIn?: string;
  }>("accounts:update", {
    idToken: signUpResponse.idToken,
    displayName: name,
    returnSecureToken: true,
  });

  const sessionTokens = {
    idToken: profileResponse.idToken ?? signUpResponse.idToken,
    refreshToken: profileResponse.refreshToken ?? signUpResponse.refreshToken,
    expiresIn: Number(profileResponse.expiresIn ?? signUpResponse.expiresIn),
  };

  await sendVerificationEmail(sessionTokens.idToken);

  return createSessionFromIdToken(sessionTokens);
}

export async function sendPasswordResetEmail(email: string) {
  return identityToolkitRequest<{ email: string }>("accounts:sendOobCode", {
    requestType: "PASSWORD_RESET",
    email,
  });
}

export async function sendVerificationEmail(idToken: string) {
  return identityToolkitRequest<{ email: string }>("accounts:sendOobCode", {
    requestType: "VERIFY_EMAIL",
    idToken,
  });
}

export async function applyEmailVerification(oobCode: string) {
  return identityToolkitRequest<{
    email: string;
    emailVerified: boolean;
    displayName?: string;
  }>("accounts:update", {
    oobCode,
  });
}

export async function verifyPasswordResetCode(oobCode: string) {
  return identityToolkitRequest<{
    email: string;
    requestType: string;
  }>("accounts:resetPassword", {
    oobCode,
  });
}

export async function confirmPasswordReset(oobCode: string, newPassword: string) {
  return identityToolkitRequest<{
    email: string;
    requestType: string;
  }>("accounts:resetPassword", {
    oobCode,
    newPassword,
  });
}

export async function refreshAuthSession(refreshToken: string) {
  const response = await secureTokenRequest<{
    expires_in: string;
    id_token: string;
    refresh_token: string;
  }>(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );

  return createSessionFromIdToken({
    idToken: response.id_token,
    refreshToken: response.refresh_token,
    expiresIn: Number(response.expires_in),
  });
}

export async function getSessionForIdToken(idToken: string) {
  const user = await lookupByIdToken(idToken);
  return user ? normalizeSessionUser(user) : null;
}

export function isFirebaseAuthApiError(error: unknown): error is FirebaseAuthApiError {
  return error instanceof FirebaseAuthApiError;
}
