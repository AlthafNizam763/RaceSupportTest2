import { NextRequest } from "next/server";
import { POST as chatPost } from "../chat/route";

export async function POST(request: NextRequest) {
  return chatPost(request);
}
