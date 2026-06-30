import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ImagePart = { type: "image_url"; image_url: { url: string } };
type TextPart = { type: "text"; text: string };
type ContentPart = TextPart | ImagePart;

const IMAGE_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
]);

function extractJson(text: string) {
  // Strip markdown code fences if present
  const stripped = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await request.json();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });

  // Fetch project details
  const { data: project } = await supabase
    .from("projects")
    .select("title, description, location_address")
    .eq("id", projectId)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Fetch all uploads
  const { data: uploads } = await supabase
    .from("uploads")
    .select("file_name, file_type, public_url, category")
    .eq("project_id", projectId);

  const allUploads = uploads ?? [];
  const imageUploads = allUploads.filter(u => IMAGE_TYPES.has((u.file_type ?? "").toLowerCase()));
  const docUploads = allUploads.filter(u => !IMAGE_TYPES.has((u.file_type ?? "").toLowerCase()));

  const content: ContentPart[] = [
    {
      type: "text",
      text: `You are a professional construction quantity surveyor. Analyze the following project and any attached drawings or images to estimate material quantities and total construction cost.

Project Title: ${project.title}
Project Description: ${project.description ?? "Not provided"}
Location: ${project.location_address ?? "Not provided"}
${docUploads.length > 0 ? `Other documents (not shown): ${docUploads.map(u => u.file_name).join(", ")}` : ""}
${imageUploads.length > 0 ? `\nCarefully study the attached engineering drawings/images below and extract all relevant details: dimensions, floor plan, structural elements, materials specified, and any quantities visible.` : `\nNo drawings were uploaded. Estimate based on the project description only.`}

Respond ONLY with a valid JSON object in this exact structure (no markdown, no explanation outside JSON):
{
  "analysis": "Detailed analysis: what you see in the drawings, key observations, project scope",
  "total_cost": <estimated total cost in SAR as a number>,
  "bill_of_quantity": [
    { "item": "Item description", "qty": <number>, "unit": "m²/m³/kg/pcs/etc", "unit_price": <number>, "total": <number> }
  ]
}

Include all relevant work items such as: excavation, concrete foundations, structural steel, concrete slabs, blockwork, plaster, tiles, roofing, windows/doors, plumbing, electrical, painting, and external works.`,
    },
    // Attach image uploads for vision analysis
    ...imageUploads.map((u): ImagePart => ({
      type: "image_url",
      image_url: { url: u.public_url },
    })),
  ];

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://project-quotation.vercel.app",
        "X-Title": "Project Quotation AI",
      },
      body: JSON.stringify({
        model: "google/gemma-4-31b-it:free",
        messages: [{ role: "user", content }],
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `OpenRouter error: ${errText}` }, { status: 502 });
    }

    const aiData = await res.json();
    const rawContent: string = aiData.choices?.[0]?.message?.content ?? "";

    const parsed = extractJson(rawContent);
    if (!parsed) {
      return NextResponse.json(
        { error: "Could not parse AI response as JSON", raw: rawContent },
        { status: 500 }
      );
    }

    return NextResponse.json({
      total_cost: typeof parsed.total_cost === "number" ? parsed.total_cost : 0,
      ai_analysis: typeof parsed.analysis === "string" ? parsed.analysis : rawContent,
      bill_of_quantity: Array.isArray(parsed.bill_of_quantity) ? parsed.bill_of_quantity : [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
