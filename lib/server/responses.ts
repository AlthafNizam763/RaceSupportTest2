import { NextResponse } from "next/server";

export function successResponse<T>(data: T, message: string, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    { status }
  );
}

export function errorResponse(message: string, status = 500, data: unknown = null) {
  return NextResponse.json(
    {
      success: false,
      data,
      message,
    },
    { status }
  );
}
