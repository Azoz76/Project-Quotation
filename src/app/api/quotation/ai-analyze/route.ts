import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ImagePart = { type: "image_url"; image_url: { url: string } };
type TextPart = { type: "text"; text: string };
type ContentPart = TextPart | ImagePart;

const IMAGE_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
]);

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";
const HEADERS_BASE = {
  "Content-Type": "application/json",
  "HTTP-Referer": "https://project-quotation.vercel.app",
  "X-Title": "Project Quotation AI",
};

function extractJson(text: string) {
  const stripped = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function callOpenRouter(apiKey: string, model: string, messages: object[], maxTokens = 4096) {
  const res = await fetch(OPENROUTER_BASE, {
    method: "POST",
    headers: { ...HEADERS_BASE, Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter [${model}] error: ${err}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "") as string;
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

  try {
    // ── STEP 1: Gemma-4 vision — extract raw information from drawings ──────
    let extractedInfo = "No drawings uploaded. Use project description only.";

    if (imageUploads.length > 0) {
      const visionContent: ContentPart[] = [
        {
          type: "text",
          text: `You are a construction document reader. Carefully examine the attached engineering drawings and images.

Extract and list ALL visible information:
- Building dimensions (length, width, height, floor areas in m²)
- Number of floors and rooms
- Structural elements (foundations, columns, beams, slabs, walls)
- Materials mentioned or shown (concrete grade, steel type, block type)
- Any visible quantities, reinforcement details, or specifications
- Window and door counts and sizes
- Roof type and area
- Any notes, legends, or annotations on the drawings

Be as specific and detailed as possible. List every measurable quantity you can read from the drawings.`,
        },
        ...imageUploads.map((u): ImagePart => ({
          type: "image_url",
          image_url: { url: u.public_url },
        })),
      ];

      extractedInfo = await callOpenRouter(
        apiKey,
        "google/gemma-4-31b-it:free",
        [{ role: "user", content: visionContent }],
        2048,
      );
    }

    // ── STEP 2: Gemma-3-27b text — produce professional quotation from extraction ──
    const synthesisPrompt = `You are a senior construction quantity surveyor in Saudi Arabia. Based on the project details and drawing analysis below, produce a complete professional construction quotation.

PROJECT DETAILS:
- Title: ${project.title}
- Description: ${project.description ?? "Not provided"}
- Location: ${project.location_address ?? "Not provided"}
${docUploads.length > 0 ? `- Supporting documents: ${docUploads.map(u => u.file_name).join(", ")}` : ""}

DRAWING ANALYSIS (extracted by AI vision):
${extractedInfo}

INSTRUCTIONS:
1. Use the extracted drawing data as the primary source for quantities
2. Apply realistic Saudi Arabian construction unit rates in SAR
3. Cover ALL major work items: site preparation, foundations, structure, masonry, finishing, MEP, external works
4. Each BOQ item must have realistic qty, unit, unit_price, and total (total = qty × unit_price)
5. The grand total_cost must equal the sum of all BOQ item totals

Respond ONLY with a valid JSON object — no markdown, no text outside the JSON:
{
  "analysis": "Professional summary: project scope, key observations from drawings, construction approach, and notable specifications",
  "total_cost": <sum of all BOQ totals as a number in SAR>,
  "bill_of_quantity": [
    { "item": "Description", "qty": <number>, "unit": "m²/m³/kg/pcs/lm/etc", "unit_price": <SAR number>, "total": <SAR number> }
  ]
}`;

    const synthesisRaw = await callOpenRouter(
      apiKey,
      "google/gemma-3-27b-it:free",
      [{ role: "user", content: synthesisPrompt }],
      4096,
    );

    const parsed = extractJson(synthesisRaw);
    if (!parsed) {
      return NextResponse.json(
        { error: "Could not parse quotation response as JSON", raw: synthesisRaw },
        { status: 500 },
      );
    }

    // Recompute total_cost from BOQ to ensure consistency
    const boq: Array<{ item: string; qty: number; unit: string; unit_price: number; total: number }> =
      Array.isArray(parsed.bill_of_quantity) ? parsed.bill_of_quantity : [];
    const computedTotal = boq.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const finalTotal = computedTotal > 0 ? computedTotal : (typeof parsed.total_cost === "number" ? parsed.total_cost : 0);

    return NextResponse.json({
      total_cost: finalTotal,
      ai_analysis: typeof parsed.analysis === "string" ? parsed.analysis : synthesisRaw,
      bill_of_quantity: boq,
      drawing_extraction: extractedInfo,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
