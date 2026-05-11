import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/server/session";

const GENERATION_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

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

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
    if (message.includes("429") || message.toLowerCase().includes("quota")) {
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
