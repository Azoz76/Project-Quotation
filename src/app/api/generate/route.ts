import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";

const TEXT_MODELS = [
  "deepseek/deepseek-r1:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
];

async function callWithFallback(apiKey: string, models: string[], messages: object[]): Promise<string> {
  const errors: string[] = [];
  for (const model of models) {
    const res = await fetch(OPENROUTER_BASE, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    }
    const err = await res.text();
    errors.push(`[${model}]: ${err}`);
    const isRetryable = res.status === 429 || res.status === 402 || err.includes("unavailable") || err.includes("free");
    if (!isRetryable) break;
  }
  throw new Error(`All models failed:\n${errors.join("\n")}`);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, type } = await request.json();
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";

  const systemPrompts: Record<string, string> = {
    description: "Generate a professional project description for a construction project. Be concise, clear, and include key details about the scope of work.",
    scope: "Generate a detailed scope of work for a construction project. Include phases, tasks, and deliverables in a structured format.",
    report: "Generate a professional construction progress report. Include sections for completed work, current status, upcoming tasks, and any issues.",
  };

  try {
    const content = await callWithFallback(apiKey, TEXT_MODELS, [
      { role: "system", content: systemPrompts[type] ?? systemPrompts.description },
      { role: "user", content: prompt },
    ]);
    return NextResponse.json({ content });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
