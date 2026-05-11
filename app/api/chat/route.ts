import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/server/session";

const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const CMS_SYSTEM_PROMPT = `You are RACE Assistant, the built-in AI helper for the RACE CMS dashboard.
You help admins manage content, uploads, settings, tickets, and other dashboard tasks.
Give direct, accurate, step-by-step guidance when asked about CMS features.
Keep answers concise but complete, and be honest when something needs troubleshooting.`;

function getOfflineHelp(userMessage: string) {
  const message = userMessage.toLowerCase();

  if (message.includes("event")) {
    return "Open Action Plan > Ongoing & Past Events, create or edit the event, then save. Reordering is handled by drag and drop.";
  }

  if (message.includes("upload")) {
    return "Open Gallery or the relevant content form, choose your file, wait for the upload to finish, then save the record.";
  }

  if (message.includes("ticket")) {
    return "Go to Support Tickets, filter if needed, then update the ticket status or delete the ticket.";
  }

  if (message.includes("team")) {
    return "Open Team RACE, switch between Leader Section and IT & Media Cell, then add, edit, upload a profile image, or reorder members.";
  }

  return "I can help with content management, uploads, team members, tickets, settings, and troubleshooting inside the CMS.";
}

export async function POST(request: NextRequest) {
  const sessionState = await requireSession(request);
  if (!sessionState) {
    return NextResponse.json({ reply: "Please sign in to use the CMS assistant." }, { status: 401 });
  }

  let lastUserMessage = "";

  try {
    const { messages } = await request.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ reply: "No messages were provided." }, { status: 400 });
    }

    lastUserMessage = messages[messages.length - 1]?.content || "";
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        reply: getOfflineHelp(lastUserMessage),
        isFallback: true,
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completionMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: CMS_SYSTEM_PROMPT },
      ...messages.map(
        (message: { role: string; content: string }): ChatCompletionMessageParam =>
          message.role === "assistant"
            ? ({ role: "assistant", content: message.content } as ChatCompletionMessageParam)
            : ({ role: "user", content: message.content } as ChatCompletionMessageParam)
      ),
    ];

    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.5,
      max_tokens: 600,
      messages: completionMessages,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "I could not generate a response.";
    return NextResponse.json({ reply });
  } catch (error: any) {
    const message = String(error?.message || "");
    if (message.includes("429") || message.toLowerCase().includes("quota")) {
      return NextResponse.json({
        reply: getOfflineHelp(lastUserMessage),
        isFallback: true,
      });
    }

    return NextResponse.json(
      {
        reply: "The assistant ran into an issue. Please try again in a moment.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
