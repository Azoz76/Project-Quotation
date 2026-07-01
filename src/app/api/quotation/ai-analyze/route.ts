import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ImagePart = { type: "image_url"; image_url: { url: string } };
type TextPart  = { type: "text"; text: string };
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

const VISION_MODELS = [
  "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.2-11b-vision-instruct:free",
  "google/gemma-3-12b-it:free",
];

const EMERGENCY_TEXT_MODELS = [
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

// Fetch live free text models — cached 10 min, 5 s network timeout
async function fetchLiveFreeModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return EMERGENCY_TEXT_MODELS;
    const { data } = await res.json() as { data: ORModel[] };
    return (data ?? [])
      .filter(m =>
        m.id.endsWith(":free") &&
        String(m.pricing?.prompt ?? "1") === "0" &&
        !(m.architecture?.modality ?? "").startsWith("image->image")
      )
      .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
      .map(m => m.id)
      .slice(0, 5); // top 5 only — faster overall
  } catch {
    return EMERGENCY_TEXT_MODELS;
  }
}

function extractJson(raw: string): Record<string, unknown> | null {
  // Strip DeepSeek / reasoning <think>...</think> blocks
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Strip markdown fences
  text = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

  try { return JSON.parse(text) as Record<string, unknown>; } catch { /* */ }

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]) as Record<string, unknown>; } catch { /* */ }
    try {
      const fixed = match[0]
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/([{,]\s*)(\w[\w\s]*)(\s*):/g, (_, pre, key, sp) => `${pre}"${key.trim()}"${sp}:`)
        .replace(/:\s*'([^']*)'/g, ': "$1"');
      return JSON.parse(fixed) as Record<string, unknown>;
    } catch { /* */ }
  }
  return null;
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: object[],
  maxTokens = 4096,
): Promise<string> {
  const res = await fetch(OPENROUTER_BASE, {
    method: "POST",
    headers: { ...HEADERS_BASE, Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, reasoning: { effort: "low" } }),
    signal: AbortSignal.timeout(40000), // 40 s per model max
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter [${model}] ${res.status}: ${err}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "") as string;
}

async function callWithFallback(
  apiKey: string, models: string[], messages: object[], maxTokens = 4096,
): Promise<string> {
  const errors: string[] = [];
  for (const model of models) {
    try {
      const result = await callOpenRouter(apiKey, model, messages, maxTokens);
      if (result.trim()) return result;
      errors.push(`[${model}]: empty`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg.slice(0, 120));
      const skip = msg.includes("429") || msg.includes("402") || msg.includes("404") ||
        msg.includes("rate") || msg.includes("unavailable") ||
        msg.includes("No endpoints") || msg.includes("free") || msg.includes("AbortError");
      if (!skip) throw e;
    }
  }
  throw new Error(`All models failed:\n${errors.slice(0, 5).join("\n")}`);
}

// Synthesis-specific: keep trying until we get ≥3 priced BOQ items OR total_cost > 0
async function callSynthesisWithValidation(
  apiKey: string, models: string[], messages: object[],
): Promise<Record<string, unknown>> {
  const errors: string[] = [];
  for (const model of models) {
    try {
      const raw = await callOpenRouter(apiKey, model, messages, 4096);
      const parsed = extractJson(raw);
      if (!parsed) { errors.push(`[${model}]: not JSON`); continue; }
      const boq = Array.isArray(parsed.bill_of_quantity) ? parsed.bill_of_quantity as unknown[] : [];
      const pricedItems = boq.filter((i: unknown) => Number((i as Record<string,unknown>).total) > 0).length;
      const total = Number(parsed.total_cost ?? 0);
      if (pricedItems >= 3 || total > 0) return parsed;
      errors.push(`[${model}]: ${boq.length} items, total=${total}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg.slice(0, 120));
      const skip = msg.includes("429") || msg.includes("402") || msg.includes("404") ||
        msg.includes("rate") || msg.includes("unavailable") ||
        msg.includes("No endpoints") || msg.includes("free") || msg.includes("AbortError");
      if (!skip) throw e;
    }
  }
  throw new Error(`No model produced valid pricing:\n${errors.slice(0, 8).join("\n")}`);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await request.json();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });

  const { data: project } = await supabase
    .from("projects").select("title, description, location_address").eq("id", projectId).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: uploads } = await supabase
    .from("uploads").select("file_name, file_type, public_url, category").eq("project_id", projectId);

  const allUploads  = uploads ?? [];
  const imageUploads = allUploads.filter(u => IMAGE_TYPES.has((u.file_type ?? "").toLowerCase()));
  const docUploads   = allUploads.filter(u => !IMAGE_TYPES.has((u.file_type ?? "").toLowerCase()));

  // Fetch live free models and resolve vision extraction in parallel
  const [liveModels, extractedInfo] = await Promise.all([
    fetchLiveFreeModels(apiKey),

    // ── STEP 1: Vision ─────────────────────────────────────────────────────────
    imageUploads.length === 0
      ? Promise.resolve("No image drawings uploaded. Estimate from project description only.")
      : callWithFallback(
          apiKey,
          VISION_MODELS,
          [{
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a construction document reader. Examine these engineering drawings and extract ALL visible information: building dimensions (m²), number of floors and rooms, structural elements, materials, quantities, reinforcement details, window/door counts and sizes, roof type and area, and any drawing annotations. Be specific and list every measurable quantity.`,
              },
              ...imageUploads.map((u): ImagePart => ({ type: "image_url", image_url: { url: u.public_url } })),
            ] as ContentPart[],
          }],
          2048,
        ).catch(() => "Drawing extraction failed. Use project description and documents to estimate."),
  ]);

  const synthesisModels = liveModels.length > 0 ? liveModels : EMERGENCY_TEXT_MODELS;

  // ── STEP 2: Synthesis ─────────────────────────────────────────────────────────
  const hasDrawings = !extractedInfo.startsWith("No image drawings") && !extractedInfo.startsWith("Drawing extraction");

  const estimateContext = hasDrawings
    ? `DRAWING ANALYSIS (primary quantity source):\n${extractedInfo}`
    : `NO DRAWINGS — estimate quantities for a typical Kuwaiti residential villa:
- 2-storey villa: ground floor 150 m², first floor 150 m² (total BUA 300 m²)
- Plot area 400 m², garden/paving ~200 m²
- RC frame, hollow block walls, ceramic tile finish
- Location: ${project.location_address ?? "Kuwait"}`;

  const synthesisPrompt = `You are a senior construction quantity surveyor in Kuwait.
Generate a complete Bill of Quantities (BOQ) and cost estimate in KWD (Kuwaiti Dinars) for this project.

PROJECT:
- Title: ${project.title}
- Description: ${project.description ?? "Residential construction"}
- Location: ${project.location_address ?? "Kuwait"}
${docUploads.length > 0 ? `- Supporting docs: ${docUploads.map(u => u.file_name).join(", ")}` : ""}

${estimateContext}

RULES:
1. Minimum 15 line items covering: Site Prep, Demolition (if any), Foundations, RC Structure, Blockwork, Waterproofing, Plastering, Tiling/Flooring, Painting, Doors & Windows, Plumbing, Electrical, HVAC, External Works
2. All prices in KWD — do NOT use SAR or any other currency
3. Every item: item (string), qty (number), unit (m²/m³/kg/pcs/lm/ls), unit_price (KWD number), total = qty × unit_price
4. total_cost = exact sum of all item totals (compute it)
5. estimated_completion: realistic project duration as a string e.g. "6 months" or "8 months"

OUTPUT: Reply with ONLY this JSON — no markdown, no explanation, start with {:
{"analysis":"<professional 2-3 sentence summary>","total_cost":<number>,"estimated_completion":"<duration>","bill_of_quantity":[{"item":"<name>","qty":<n>,"unit":"<u>","unit_price":<n>,"total":<n>}]}`;

  try {
    const parsed = await callSynthesisWithValidation(apiKey, synthesisModels, [
      { role: "user", content: synthesisPrompt },
    ]);

    const boq: Array<{ item: string; qty: number; unit: string; unit_price: number; total: number }> =
      Array.isArray(parsed.bill_of_quantity)
        ? (parsed.bill_of_quantity as Array<{ item: string; qty: number; unit: string; unit_price: number; total: number }>)
        : [];

    const computedTotal = boq.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const finalTotal = computedTotal > 0 ? computedTotal : (Number(parsed.total_cost) || 0);
    const completion = typeof parsed.estimated_completion === "string"
      ? parsed.estimated_completion
      : null;

    return NextResponse.json({
      total_cost: finalTotal,
      ai_analysis: typeof parsed.analysis === "string" ? parsed.analysis : project.title,
      bill_of_quantity: boq,
      estimated_completion: completion,
      drawing_extraction: extractedInfo,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
