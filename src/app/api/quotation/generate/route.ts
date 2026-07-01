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
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" } }),
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
  const { projectId, userId } = await request.json();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY ?? "";

  const [{ data: uploads }, { data: project }] = await Promise.all([
    supabase.from("uploads").select("file_name").eq("project_id", projectId).eq("category", "drawing"),
    supabase.from("projects").select("title, description").eq("id", projectId).single(),
  ]);

  const prompt = `You are a construction quantity surveyor AI. Analyze the following project and uploaded engineering drawings to calculate material quantities and costs.

Project: ${project?.title}
Description: ${project?.description ?? "N/A"}
Drawings uploaded: ${(uploads ?? []).map((u) => u.file_name).join(", ")}

Provide your response as JSON:
{
  "analysis": "Brief analysis of the project",
  "materials": [
    { "name": "Steel Reinforcement", "quantity": 500, "unit": "kg", "unit_price": 1.20, "total": 600 }
  ],
  "total_cost": 2400
}`;

  try {
    const liveModels = await fetchLiveFreeModels(apiKey);
    const models = liveModels.length > 0 ? liveModels : EMERGENCY_MODELS;
    const content = await callWithFallback(apiKey, models, [{ role: "user", content: prompt }]);
    const parsed = JSON.parse(content);

    const { data: quotation } = await supabase
      .from("quotations")
      .insert({
        project_id: projectId,
        user_id: userId,
        materials: parsed.materials ?? [],
        total_cost: parsed.total_cost ?? 0,
        ai_analysis: parsed.analysis ?? null,
        status: "generated",
      })
      .select()
      .single();

    await supabase.from("projects").update({ status: "quoted" }).eq("id", projectId);
    await supabase.from("notifications").insert({
      user_id: userId,
      message: `Quotation generated for project "${project?.title}"`,
      link: `/dashboard/projects/${projectId}`,
    });

    return NextResponse.json({ quotation });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to generate quotation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
