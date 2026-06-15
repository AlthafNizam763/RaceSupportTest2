import { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";

import { getAdminApp, getAdminFirestore } from "@/lib/server/firebase-admin";
import { requireAdminSession } from "@/lib/server/session";
import { errorResponse, successResponse } from "@/lib/server/responses";
import { AdminUserCreateSchema } from "@/lib/api/schemas";

export const runtime = "nodejs";

const getAdminAuth = () => getAuth(getAdminApp());

export async function GET(request: NextRequest) {
  const sessionState = await requireAdminSession(request);
  if (!sessionState) {
    return errorResponse("Permission denied. Admin role required.", 403);
  }

  try {
    const auth = getAdminAuth();
    const db = getAdminFirestore();

    // List all users from Firebase Auth
    const listUsersResult = await auth.listUsers();
    const authUsers = listUsersResult.users;

    // Fetch all user roles from Firestore
    const firestoreUsersSnapshot = await db.collection("users").get();
    const firestoreUsersMap = new Map();
    firestoreUsersSnapshot.docs.forEach((doc) => {
      firestoreUsersMap.set(doc.id, doc.data());
    });

    // Merge authentication records with role profiles
    const mergedUsers = authUsers.map((authUser) => {
      const dbUser = firestoreUsersMap.get(authUser.uid) || {};
      return {
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName || dbUser.name || authUser.email || "User",
        disabled: authUser.disabled,
        role: dbUser.role || "editor", // default fallback
        createdAt: authUser.metadata.creationTime || dbUser.createdAt || new Date().toISOString(),
        lastSignInTime: authUser.metadata.lastSignInTime || null,
      };
    });

    return successResponse(mergedUsers, "Users retrieved successfully.");
  } catch (error: any) {
    return errorResponse(error.message || "Failed to retrieve users.", 500);
  }
}

export async function POST(request: NextRequest) {
  const sessionState = await requireAdminSession(request);
  if (!sessionState) {
    return errorResponse("Permission denied. Admin role required.", 403);
  }

  try {
    const body = await request.json();
    const parsed = AdminUserCreateSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Validation failed.", 400, parsed.error.flatten());
    }

    const { name, email, password, role } = parsed.data;
    const auth = getAdminAuth();
    const db = getAdminFirestore();

    // Create user in Firebase Authentication
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });

    // Save user profile in Firestore
    const userProfile = {
      uid: userRecord.uid,
      name,
      email,
      role,
      createdAt: new Date().toISOString(),
    };

    await db.collection("users").doc(userRecord.uid).set(userProfile);

    return successResponse(
      {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role,
        disabled: userRecord.disabled,
        createdAt: userProfile.createdAt,
      },
      "User created successfully.",
      201
    );
  } catch (error: any) {
    return errorResponse(error.message || "Failed to create user.", 500);
  }
}
