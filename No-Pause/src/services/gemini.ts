const GEMINI_GENERATE_CONTENT_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function getGeminiApiKey(): string {
  const processEnv =
    typeof process !== "undefined"
      ? (process.env as Record<string, string | undefined>)
      : undefined;
  const apiKey = processEnv?.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  return apiKey;
}

function parseGeminiText(data: unknown): string {
  const maybeData = data as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: unknown }>;
      };
    }>;
  } | null;

  return (
    maybeData?.candidates?.[0]?.content?.parts
      ?.map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim() ?? ""
  );
}

export async function generateGeminiText(prompt: string): Promise<string> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error("Gemini prompt is empty");
  }

  const url = new URL(GEMINI_GENERATE_CONTENT_URL);
  url.searchParams.set("key", getGeminiApiKey());
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  const response = await fetch(url, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: trimmed }],
        },
      ],
      generationConfig: {
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 300,
      },
    }),
  }).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini generateContent failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  return parseGeminiText(data) || "I could not generate feedback right now.";
}
