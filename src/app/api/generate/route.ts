import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";

const EMERGENCY_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-2-9b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];

type ORModel = {
  id: string;
  context_length?: number;
  pricing?: { prompt?: string };
  architecture?: { modality?: string };
};

async function fetchLiveFreeModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      next: { revalidate: 180 },
    });
    if (!res.ok) return EMERGENCY_MODELS;
    const { data } = await res.json() as { data: ORModel[] };
    return (data ?? [])
      .filter(m =>
        m.id.endsWith(":free") &&
        String(m.pricing?.prompt ?? "1") === "0" &&
        !(m.architecture?.modality ?? "").startsWith("image->image")
      )
      .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
      .map(m => m.id)
      .slice(0, 20);
  } catch {
    return EMERGENCY_MODELS;
  }
}

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
      const content = data.choices?.[0]?.message?.content ?? "";
      if (content.trim()) return content;
    }
    const err = await res.text();
    errors.push(`[${model}] ${res.status}: ${err.slice(0, 120)}`);
    const skip = res.status === 429 || res.status === 402 || res.status === 404 ||
      err.includes("unavailable") || err.includes("No endpoints") || err.includes("free");
    if (!skip) break;
  }
  throw new Error(`All models failed:\n${errors.slice(0, 5).join("\n")}`);
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
    const liveModels = await fetchLiveFreeModels(apiKey);
    const models = liveModels.length > 0 ? liveModels : EMERGENCY_MODELS;
    const content = await callWithFallback(apiKey, models, [
      { role: "system", content: systemPrompts[type] ?? systemPrompts.description },
      { role: "user", content: prompt },
    ]);
    return NextResponse.json({ content });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
