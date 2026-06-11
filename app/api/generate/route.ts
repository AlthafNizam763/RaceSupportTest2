import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/server/session";

const isGeminiKey = (process.env.OPENAI_API_KEY || "").startsWith("AQ.") || (process.env.OPENAI_API_KEY || "").startsWith("AIzaSy");
const GENERATION_MODEL = process.env.OPENAI_MODEL || (isGeminiKey ? "gemini-2.5-flash" : "gpt-4.1-mini");
const CHAT_BASE_URL = process.env.OPENAI_BASE_URL || (isGeminiKey ? "https://generativelanguage.googleapis.com/v1beta/openai/" : undefined);

export async function POST(request: NextRequest) {
  const sessionState = await requireSession(request);
  if (!sessionState) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  let title = "";
  let category = "";

  try {
    const body = await request.json();
    title = body.title;
    category = body.category;
    if (!title || !category) {
      return NextResponse.json({ error: "Missing title or category." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        content: `Preview for "${title}": a concise, polished ${String(category).toLowerCase()} summary ready for editing once an OpenAI API key is configured.`,
        isFallback: true,
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      ...(CHAT_BASE_URL ? { baseURL: CHAT_BASE_URL } : {}),
    });
    const completion = await client.chat.completions.create({
      model: GENERATION_MODEL,
      temperature: 0.7,
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content:
            "You write polished CMS copy. Produce short, engaging, publication-ready text under 100 words.",
        },
        {
          role: "user",
          content: `Write a ${String(category).toLowerCase()} description for "${title}".`,
        },
      ],
    });

    return NextResponse.json({
      content: completion.choices[0]?.message?.content?.trim() || "",
    });
  } catch (error: any) {
    const message = String(error?.message || "");
    if (
      message.includes("429") ||
      message.includes("401") ||
      message.includes("403") ||
      message.includes("404") ||
      message.toLowerCase().includes("quota") ||
      message.toLowerCase().includes("api key")
    ) {
      return NextResponse.json({
        content: `Preview for "${title || "this item"}": a concise ${(category || "content").toLowerCase()} summary generated from the local fallback because the OpenAI quota is currently exhausted.`,
        isFallback: true,
      });
    }

    return NextResponse.json(
      { error: error.message || "Failed to generate AI content." },
      { status: 500 }
    );
  }
}
