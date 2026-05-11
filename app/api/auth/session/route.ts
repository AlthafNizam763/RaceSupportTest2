import { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies, clearSessionCookies, getSessionState } from "@/lib/server/session";

export async function GET(request: NextRequest) {
  const state = await getSessionState(request);

  if (!state.session) {
    const response = errorResponse("No active session found.", 401);
    return clearSessionCookies(response, request);
  }

  const response = successResponse({ user: state.session.user }, "Session loaded.");
  return state.refreshed ? applySessionCookies(response, state.session, request) : response;
}
