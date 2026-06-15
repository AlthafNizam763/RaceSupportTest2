import { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies, clearSessionCookies, getSessionState, getUserRoleServer } from "@/lib/server/session";

export async function GET(request: NextRequest) {
  const state = await getSessionState(request);

  if (!state.session) {
    const response = errorResponse("No active session found.", 401);
    return clearSessionCookies(response, request);
  }

  const role = await getUserRoleServer(
    state.session.user.uid,
    state.session.user.email,
    state.session.user.displayName
  );

  const response = successResponse(
    {
      user: {
        ...state.session.user,
        role,
      },
    },
    "Session loaded."
  );
  return state.refreshed ? applySessionCookies(response, state.session, request) : response;
}
