import { emitAuthChange } from "@/lib/api/events";
import { apiFetch, jsonRequest } from "@/lib/api/fetcher";

export interface SessionUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  photoUrl?: string;
}

interface SessionPayload {
  user: SessionUser;
}

interface VerificationPayload {
  email: string;
  user: SessionUser | null;
}

async function withAuthNotification<T>(promise: Promise<T>) {
  const result = await promise;
  emitAuthChange();
  return result;
}

export const login = async (email: string, pass: string) => {
  return withAuthNotification(
    apiFetch<SessionPayload>("/api/auth/login", {
      method: "POST",
      ...jsonRequest({ email, password: pass }),
    })
  );
};

export const registerUser = async (name: string, email: string, pass: string) => {
  return withAuthNotification(
    apiFetch<SessionPayload>("/api/auth/register", {
      method: "POST",
      ...jsonRequest({ name, email, password: pass }),
    })
  );
};

export const logout = async () => {
  return withAuthNotification(
    apiFetch<null>("/api/auth/logout", {
      method: "POST",
    })
  );
};

export const forgotPassword = async (email: string) => {
  return apiFetch<null>("/api/auth/forgot-password", {
    method: "POST",
    ...jsonRequest({ email }),
  });
};

export const resendVerificationEmail = async () => {
  return apiFetch<null>("/api/auth/verify-email", {
    method: "POST",
  });
};

export const confirmVerificationEmail = async (oobCode: string) => {
  return withAuthNotification(
    apiFetch<VerificationPayload>("/api/auth/verify-email", {
      method: "PATCH",
      ...jsonRequest({ oobCode }),
    })
  );
};

export const getSession = async () => {
  return apiFetch<SessionPayload>("/api/auth/session");
};

export const verifyResetCode = async (oobCode: string) => {
  return apiFetch<{ email: string }>("/api/auth/reset-password", {
    method: "POST",
    ...jsonRequest({ oobCode }),
  });
};

export const resetPassword = async (oobCode: string, newPassword: string) => {
  return apiFetch<{ email: string }>("/api/auth/reset-password", {
    method: "PATCH",
    ...jsonRequest({ oobCode, newPassword }),
  });
};
