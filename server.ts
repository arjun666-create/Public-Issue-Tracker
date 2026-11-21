import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { sanitizeInput, validateBase64ImagePayload } from './src/utils/security';
import { validateTriageResponseSchema } from './src/utils/triageLogic';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACTIVE_GEMINI_MODEL = 'gemini-2.5-flash';

const ALLOWED_CATEGORIES = [
  'Roads & Potholes',
  'Sanitation & Waste',
  'Streetlights & Electrical',
  'Water Supply & Drainage',
  'Parks & Public Spaces',
  'Other',
] as const;

const ALLOWED_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

const SYSTEM_INSTRUCTION = `You are the Senior Municipal Triage Engineer for CivicResolve, an urban infrastructure triage platform.
Your job is to inspect citizen-reported civic complaints (text and optional field photograph) and return a strict structured JSON assessment for municipal dispatch.

Rules:
1. verified_category: Choose the single most accurate category from: ${ALLOWED_CATEGORIES.join(', ')}. Override the citizen's selected category if the complaint text or photograph clearly belongs to a different category.
2. priority_level: Assign exactly one of "Low", "Medium", "High", or "Critical" based on immediate public safety hazards:
   - Critical: Immediate life-safety or severe hazard (exposed/live electrical wires, open manholes, deep craters/potholes near schools or hospitals, major water main rupture flooding roadways, fallen trees blocking arterial roads).
   - High: Significant infrastructure failure or fast-escalating hazard (unlit major road intersections, severe drainage overflow, large potholes on busy streets).
   - Medium: Localized civic nuisance or service disruption without acute danger (overflowing garbage bins, minor pavement cracks, single dim residential lamp).
   - Low: Routine maintenance or aesthetic wear (park bench repair, faded signage, minor litter).
3. priority_reasoning: Write a concise 1-sentence justification explaining why this priority level was chosen.
4. recommended_department: Route to the most specific municipal department, such as "Storm Water Drain & Roads Dept", "Solid Waste Management", "TANGEDCO / Streetlight Maintenance", "Metro Water & Sewerage Board", "Parks & Urban Forestry Dept", or "General Municipal Works".
5. ai_visual_verification: If a photograph is attached, verify whether the image matches the description and highlight visible hazards in 1-2 crisp sentences. If no image is attached, state exactly: "No image attached".
6. actionable_summary: Write a crisp, technical 1-sentence dispatch directive for field engineers.`;

interface AiConfigPayload {
  sensitivity?: 'conservative' | 'balanced' | 'high-alert';
  systemInstructionOverride?: string;
  languageTone?: 'technical' | 'citizen' | 'bilingual';
}

interface TriageRequestBody {
  title?: string;
  description?: string;
  location?: string;
  userCategory?: string;
  imageBase64?: string;
  imageMimeType?: string;
  aiConfig?: AiConfigPayload;
}

/**
 * Combines base/override system prompt with sensitivity and tone directives.
 */
function buildEffectiveSystemInstruction(aiConfig?: AiConfigPayload): string {
  const sanitizedOverride =
    typeof aiConfig?.systemInstructionOverride === 'string'
      ? sanitizeInput(aiConfig.systemInstructionOverride)
      : '';

  const base = sanitizedOverride.length > 0 ? sanitizedOverride : SYSTEM_INSTRUCTION;

  const sensitivityDirective =
    aiConfig?.sensitivity === 'high-alert'
      ? 'URGENCY SENSITIVITY (HIGH-ALERT): Adopt a precautionary safety stance. Treat any school-zone hazard, standing water/waterlogging, monsoon flooding, electrical panel issue, or pedestrian obstruction as Critical or High priority.'
      : aiConfig?.sensitivity === 'conservative'
        ? 'URGENCY SENSITIVITY (CONSERVATIVE): Reserve Critical strictly for verified immediate life-safety emergencies (active live wires, collapsed bridges, severe main ruptures). Classify routine or localized issues as Low or Medium.'
        : 'URGENCY SENSITIVITY (BALANCED): Weigh verified safety risk, traffic exposure, and infrastructure severity proportionally.';

  const toneDirective =
    aiConfig?.languageTone === 'citizen'
      ? 'OUTPUT TONE (CITIZEN-FRIENDLY): Write priority_reasoning and actionable_summary in clear, reassuring, everyday plain English easy for residents to understand without heavy jargon.'
      : aiConfig?.languageTone === 'bilingual'
        ? 'OUTPUT TONE (BILINGUAL ENGLISH + TAMIL): Write priority_reasoning and actionable_summary first in concise English followed by a brief Tamil translation in parentheses/newline (e.g., "English summary — தமிழ்: ..."). Keep verified_category and priority_level strictly as the exact English enum values.'
        : 'OUTPUT TONE (TECHNICAL ENGINEERING BRIEF): Write priority_reasoning and actionable_summary as crisp, technical municipal engineering directives for field crews.';

  return `${base}\n\n${sensitivityDirective}\n${toneDirective}`;
}

const triageResponseSchema = {
  type: Type.OBJECT,
  properties: {
    verified_category: {
      type: Type.STRING,
      enum: [...ALLOWED_CATEGORIES],
      description: 'Verified civic issue category, overriding user category if inaccurate.',
    },
    priority_level: {
      type: Type.STRING,
      enum: [...ALLOWED_PRIORITIES],
      description: 'Hazard-based priority level.',
    },
    priority_reasoning: {
      type: Type.STRING,
      description: 'Brief 1-sentence explanation of why this priority was assigned.',
    },
    recommended_department: {
      type: Type.STRING,
      description: 'Specific municipal department assigned to handle the issue.',
    },
    ai_visual_verification: {
      type: Type.STRING,
      description: 'Visual check confirming image alignment and visible hazards, or "No image attached".',
    },
    actionable_summary: {
      type: Type.STRING,
      description: 'Crisp technical 1-sentence summary for field engineers.',
    },
  },
  required: [
    'verified_category',
    'priority_level',
    'priority_reasoning',
    'recommended_department',
    'ai_visual_verification',
    'actionable_summary',
  ],
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractErrorDetails(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('400')) {
    return {
      status: 400,
      message:
        'The configured Gemini API key appears invalid. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      message:
        'Permission denied by Gemini API. Check your GEMINI_API_KEY permissions in Settings > Secrets.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'Gemini API rate limit or quota reached. Please wait a moment and try submitting again.',
    };
  }
  return {
    status: 500,
    message: `AI triage service failed: ${rawMessage}`,
  };
}

function hasValidGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 0 && key !== 'MY_GEMINI_API_KEY');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const start = Date.now();
    const configured = hasValidGeminiKey();
    const latencyMs = Math.max(1, Date.now() - start);
    res.json({
      ok: true,
      geminiConfigured: configured,
      model: ACTIVE_GEMINI_MODEL,
      sdk: '@google/genai',
      latencyMs,
      keyMask: configured ? 'ENV:GEMINI_API_KEY (••••••••••••••••)' : 'Not Configured',
      checkedAt: new Date().toISOString(),
    });
  });

  app.post('/api/triage', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets to run AI triage.',
      });
      return;
    }

    const body = (req.body ?? {}) as TriageRequestBody;
    const title = sanitizeInput(typeof body.title === 'string' ? body.title : '');
    const description = sanitizeInput(typeof body.description === 'string' ? body.description : '');
    const location = sanitizeInput(typeof body.location === 'string' ? body.location : '');
    const rawCategory = sanitizeInput(typeof body.userCategory === 'string' ? body.userCategory : 'Other');
    const userCategory = ALLOWED_CATEGORIES.includes(
      rawCategory as (typeof ALLOWED_CATEGORIES)[number],
    )
      ? rawCategory
      : 'Other';

    if (!title || !description || !location) {
      res.status(400).json({
        error: 'Please provide a valid issue title, detailed description, and location before submitting.',
      });
      return;
    }

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    let hasImage = false;
    if (typeof body.imageBase64 === 'string' && body.imageBase64.trim().length > 0) {
      const checked = validateBase64ImagePayload(body.imageBase64, body.imageMimeType);
      if (!checked.valid) {
        res.status(400).json({ error: checked.error || 'Invalid uploaded image payload.' });
        return;
      }

      parts.push({
        inlineData: {
          mimeType: checked.mimeType,
          data: checked.base64Data,
        },
      });
      hasImage = true;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const promptText = [
      `Citizen Report Details:`,
      `- Issue Title: ${title}`,
      `- Location / Landmark: ${location}`,
      `- Citizen-Selected Category: ${userCategory}`,
      `- Detailed Description: ${description}`,
      `- Photograph Attached: ${hasImage ? 'Yes (see attached image)' : 'No (set ai_visual_verification to "No image attached")'}`,
      ``,
      `Analyze this civic issue and return the structured JSON triage assessment.`,
    ].join('\n');

    parts.push({ text: promptText });

    const effectiveInstruction = buildEffectiveSystemInstruction(body.aiConfig);
    const requestStart = Date.now();
    let lastError: unknown;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: ACTIVE_GEMINI_MODEL,
          contents: { parts },
          config: {
            systemInstruction: effectiveInstruction,
            responseMimeType: 'application/json',
            responseSchema: triageResponseSchema,
          },
        });

        const rawJson = (response.text ?? '').trim();
        if (!rawJson) {
          throw new Error('Gemini returned an empty triage response.');
        }

        const parsed = JSON.parse(rawJson) as Record<string, unknown>;
        const schemaCheck = validateTriageResponseSchema({
          verified_category: ALLOWED_CATEGORIES.includes(
            parsed.verified_category as (typeof ALLOWED_CATEGORIES)[number],
          )
            ? parsed.verified_category
            : userCategory,
          priority_level: ALLOWED_PRIORITIES.includes(
            parsed.priority_level as (typeof ALLOWED_PRIORITIES)[number],
          )
            ? parsed.priority_level
            : 'Medium',
          priority_reasoning:
            typeof parsed.priority_reasoning === 'string' && parsed.priority_reasoning.trim()
              ? sanitizeInput(parsed.priority_reasoning)
              : 'Assessed based on reported urban infrastructure impact.',
          recommended_department:
            typeof parsed.recommended_department === 'string' && parsed.recommended_department.trim()
              ? sanitizeInput(parsed.recommended_department)
              : 'General Municipal Works',
          ai_visual_verification: hasImage
            ? typeof parsed.ai_visual_verification === 'string' && parsed.ai_visual_verification.trim()
              ? sanitizeInput(parsed.ai_visual_verification)
              : 'Image analyzed alongside citizen report.'
            : 'No image attached',
          actionable_summary:
            typeof parsed.actionable_summary === 'string' && parsed.actionable_summary.trim()
              ? sanitizeInput(parsed.actionable_summary)
              : `Dispatch field crew to inspect ${title} at ${location}.`,
        });

        if (!schemaCheck.valid) {
          throw new Error(`Triage schema mismatch: ${schemaCheck.errors.join(', ')}`);
        }

        const latencyMs = Math.max(1, Date.now() - requestStart);
        res.json({
          triage: schemaCheck.data,
          diagnostics: {
            model: ACTIVE_GEMINI_MODEL,
            sdk: '@google/genai',
            latencyMs,
          },
        });
        return;
      } catch (err) {
        lastError = err;
        const details = extractErrorDetails(err);
        if ((details.status === 429 || details.status >= 500) && attempt < maxAttempts) {
          await sleep(600 * Math.pow(2, attempt - 1));
          continue;
        }
        res.status(details.status).json({ error: details.message });
        return;
      }
    }

    const fallback = extractErrorDetails(lastError);
    res.status(fallback.status).json({ error: fallback.message });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`CivicResolve server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CivicResolve server:', err);
  process.exit(1);
});
