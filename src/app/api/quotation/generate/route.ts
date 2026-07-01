import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { projectId, userId } = await request.json();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: uploads } = await supabase
    .from("uploads")
    .select("file_name, file_type, public_url, category")
    .eq("project_id", projectId)
    .eq("category", "drawing");

  const { data: project } = await supabase
    .from("projects")
    .select("title, description")
    .eq("id", projectId)
    .single();

  const prompt = `You are a construction quantity surveyor AI. Analyze the following project and uploaded engineering drawings to calculate material quantities and costs.

Project: ${project?.title}
Description: ${project?.description ?? "N/A"}
Drawings uploaded: ${(uploads ?? []).map((u) => u.file_name).join(", ")}

Based on the drawing file names and project description, estimate the quantities of materials needed. Provide your response as JSON with this structure:
{
  "analysis": "Brief analysis of the project",
  "materials": [
    { "name": "Steel Reinforcement", "quantity": 500, "unit": "kg", "unit_price": 1.20, "total": 600 },
    { "name": "Concrete (C25)", "quantity": 15, "unit": "m³", "unit_price": 120, "total": 1800 }
  ],
  "total_cost": 2400
}

Include materials like: steel reinforcement, concrete, blocks/bricks, cement, sand, gravel, timber, roofing materials, plumbing, and electrical as applicable.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemma-3-27b-it",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    const aiResponse = await res.json();
    const content = aiResponse.choices?.[0]?.message?.content ?? "{}";
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
    return NextResponse.json({ error: "Failed to generate quotation" }, { status: 500 });
  }
}
