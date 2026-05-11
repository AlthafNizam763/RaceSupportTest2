import { NextResponse } from "next/server";

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export async function verifyAuth(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify token via Firebase Auth REST API
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.users[0]; // Returns user info if valid
  } catch (error) {
    console.error("Auth verification failed:", error);
    return null;
  }
}

export function apiResponse(success: boolean, data: any, message: string, status = 200) {
  return NextResponse.json({ success, data, message }, { status });
}
