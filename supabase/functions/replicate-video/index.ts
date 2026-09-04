// Nexus AI — Replicate video generation edge function
// Proxies image-to-video generation through Replicate's REST API.
// The Replicate API token is stored in the ai_provider_keys table and
// resolved with the service role key — never exposed to the browser.
//
// Two actions via the `action` field:
//   "create" — starts a new prediction, returns prediction id + status
//   "poll"   — polls an existing prediction by id, returns current status

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

interface CreateBody {
  action: "create";
  imageUrl: string;
  model?: string;
}

interface PollBody {
  action: "poll";
  predictionId: string;
}

type RequestBody = CreateBody | PollBody;

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveReplicateToken(): Promise<string | null> {
  const envToken = Deno.env.get("REPLICATE_API_TOKEN");
  if (envToken) return envToken;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/ai_provider_keys?select=api_key&provider=eq.replicate&enabled=eq.true&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { api_key: string }[];
    return rows[0]?.api_key ?? null;
  } catch {
    return null;
  }
}

// Model definitions — maps our model slug to Replicate model owner/name + version.
// We use the official "model" field (owner/name:version) format for create prediction.
const MODEL_VERSIONS: Record<string, { model: string; version: string }> = {
  "stability-ai/stable-video-diffusion": {
    model: "stability-ai/stable-video-diffusion",
    version: "3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
  },
};

async function createPrediction(
  token: string,
  imageUrl: string,
  modelSlug: string,
): Promise<{ id: string; status: string; urls: { get: string } }> {
  const cfg = MODEL_VERSIONS[modelSlug] ?? MODEL_VERSIONS["stability-ai/stable-video-diffusion"];

  const res = await fetch(`${REPLICATE_API_BASE}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=2",
    },
    body: JSON.stringify({
      version: cfg.version,
      input: {
        cond_image: imageUrl,
        video_length: 14,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Replicate error ${res.status}: ${errText.slice(0, 400)}`);
  }

  return await res.json();
}

async function pollPrediction(
  token: string,
  predictionId: string,
): Promise<{
  status: string;
  output: string | string[] | null;
  error: string | null;
  logs: string | null;
}> {
  const res = await fetch(`${REPLICATE_API_BASE}/predictions/${predictionId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Replicate poll error ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = await res.json();
  return {
    status: data.status,
    output: data.output,
    error: data.error,
    logs: data.logs,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError(405, "Method not allowed. Use POST.");
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (!body?.action) {
      return jsonError(400, "Missing 'action' field.");
    }

    const token = await resolveReplicateToken();
    if (!token) {
      return jsonError(500, "Replicate API token not configured.");
    }

    if (body.action === "create") {
      const { imageUrl, model } = body as CreateBody;
      if (!imageUrl) {
        return jsonError(400, "Missing 'imageUrl'.");
      }
      const result = await createPrediction(token, imageUrl, model ?? "stability-ai/stable-video-diffusion");
      return new Response(
        JSON.stringify({ predictionId: result.id, status: result.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.action === "poll") {
      const { predictionId } = body as PollBody;
      if (!predictionId) {
        return jsonError(400, "Missing 'predictionId'.");
      }
      const result = await pollPrediction(token, predictionId);
      let videoUrl: string | null = null;
      if (result.output) {
        videoUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      }
      return new Response(
        JSON.stringify({
          status: result.status,
          videoUrl,
          error: result.error,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return jsonError(400, `Unknown action: ${(body as { action: string }).action}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError(500, message);
  }
});
