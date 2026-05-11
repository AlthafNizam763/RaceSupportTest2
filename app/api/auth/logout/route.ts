import { NextRequest, NextResponse } from "next/server";

import { clearSessionCookies } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    {
      success: true,
      data: null,
      message: "Logged out successfully.",
    },
    { status: 200 }
  );

  return clearSessionCookies(response, request);
}
