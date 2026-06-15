import { NextRequest } from "next/server";

import { registerWithEmailPassword } from "@/lib/server/firebase-auth";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { applySessionCookies } from "@/lib/server/session";
import { getAdminFirestore } from "@/lib/server/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return errorResponse("Name, email, and password are required.", 400);
    }

    const session = await registerWithEmailPassword(name, email, password);

    // Create a record in Firestore users collection
    const db = getAdminFirestore();
    const userRef = db.collection("users").doc(session.user.uid);
    const adminsSnapshot = await db.collection("users").where("role", "==", "admin").limit(1).get();
    const role = adminsSnapshot.empty ? "admin" : "editor";

    await userRef.set({
      uid: session.user.uid,
      name,
      email,
      role,
      createdAt: new Date().toISOString(),
    });

    const response = successResponse(
      {
        user: {
          ...session.user,
          role,
        },
      },
      "Account created successfully. Verification email sent.",
      201
    );

    return applySessionCookies(response, session, request);
  } catch (error: any) {
    return errorResponse(error.message || "Failed to register account.", error.status || 400);
  }
}
