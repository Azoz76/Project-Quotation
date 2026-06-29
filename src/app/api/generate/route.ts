import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, type } = await request.json();

  const systemPrompts: Record<string, string> = {
    description: "Generate a professional project description for a construction project. Be concise, clear, and include key details about the scope of work.",
    scope: "Generate a detailed scope of work for a construction project. Include phases, tasks, and deliverables in a structured format.",
    report: "Generate a professional construction progress report. Include sections for completed work, current status, upcoming tasks, and any issues.",
  };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: systemPrompts[type] ?? systemPrompts.description },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
