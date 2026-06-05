import { getAIFeedback } from "./groq.js";
import { getWordCount } from "../lib/core/utils.js";

export type AiFeedbackResult = {
  band: number;
  feedback: string;
};

export type AnalyzePracticeSpeechInput = {
  transcript: string;
  topic?: string;
  flowScore?: number;
  hesitationCount?: number;
  speakingTime?: number;
  wordCount?: number;
};

export function isUsableTranscript(transcript: string): boolean {
  return getWordCount(transcript) >= 3;
}

const NON_ENGLISH_FEEDBACK =
  "Please speak in English to get a score and feedback. Your transcript is shown above.";

const LANGUAGE_GATE = `FIRST check the language. If the TRANSCRIPT is not predominantly in English, ignore all criteria below and respond exactly with:
{"band": 0, "feedback": ""}
Otherwise, evaluate as follows.

`;

const FEEDBACK_SYSTEM_PROMPT = `You are a speech coach giving feedback on a spoken response to a specific topic.

${LANGUAGE_GATE}You will receive:
- TOPIC: the prompt the user was given
- TRANSCRIPT: what they said
- STATS: speaking time, word count, pause count

Evaluate the transcript on exactly these 4 criteria, all relative to the topic:

1. TOPIC RELEVANCE — did they actually address the topic, or drift?
2. IDEA DEVELOPMENT — did they expand their points with reasoning, or just state them once?
3. SUPPORTING DETAILS — did they use examples, specifics, or evidence?
4. LOGICAL CONNECTION — do sentences and ideas link together in a coherent thread?

Assign a band 1–9:
- 1–2: off-topic, or barely addresses the prompt; incoherent or disconnected
- 3–4: on-topic but shallow; ideas stated, not developed; few or no supporting details
- 5–6: addresses the topic with some development and at least one supporting detail; ideas mostly connect
- 7–8: well-developed response; clear logical thread; good use of specifics tied to the topic
- 9: exceptionally tight; every idea supports the topic; strong reasoning and details throughout

Be strict. Default to a lower band unless evidence is clearly present in the transcript. A response that mentions the topic but says little of substance is a 3, not a 5.

Write 2–4 sentences of feedback. Be direct and specific — quote the transcript when pointing out strengths or weaknesses. No generic praise.

Respond only in this JSON format:
{"band": <1-9>, "feedback": "<your feedback here>"}`;

const FREE_SPEECH_SYSTEM_PROMPT = `You are a speech coach giving feedback on a freely-spoken response (no assigned topic).

${LANGUAGE_GATE}You will receive:
- TRANSCRIPT: what they said
- STATS: speaking time, word count, pause count

Evaluate the transcript on exactly these 3 criteria, judging the speech on its own merit:

1. IDEA DEVELOPMENT — did they expand their points with reasoning, or just state them once?
2. SUPPORTING DETAILS — did they use examples, specifics, or evidence?
3. LOGICAL CONNECTION — do sentences and ideas link together in a coherent thread?

Assign a band 1–9:
- 1–2: incoherent or disconnected; ideas barely formed
- 3–4: shallow; ideas stated, not developed; few or no supporting details
- 5–6: some development and at least one supporting detail; ideas mostly connect
- 7–8: well-developed; clear logical thread; good use of specifics
- 9: exceptionally tight; strong reasoning and details throughout

Be strict. Default to a lower band unless evidence is clearly present in the transcript. A response that says little of substance is a 3, not a 5.

Write 2–4 sentences of feedback. Be direct and specific — quote the transcript when pointing out strengths or weaknesses. No generic praise.

Respond only in this JSON format:
{"band": <1-9>, "feedback": "<your feedback here>"}`;

function parseAiFeedbackResponse(raw: string): AiFeedbackResult {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.band === "number" &&
      Number.isInteger(parsed.band) &&
      parsed.band >= 0 &&
      parsed.band <= 9 &&
      typeof parsed.feedback === "string"
    ) {
      // Band 0 = non-English transcript. Override with deterministic note.
      if (parsed.band === 0) {
        return { band: 0, feedback: NON_ENGLISH_FEEDBACK };
      }
      return { band: parsed.band, feedback: parsed.feedback };
    }
  } catch {
    // JSON parse failed — fall through to fallback
  }
  return { band: 5, feedback: raw };
}

const buildPracticeFeedbackUserMessage = (input: {
  topic?: string;
  transcript: string;
  hesitationCount: number;
  speakingTime: number;
  wordCount: number;
}) =>
  `${input.topic ? `TOPIC: ${input.topic}\n` : ""}TRANSCRIPT: ${input.transcript}
STATS: speaking time ${input.speakingTime}s, word count ${input.wordCount}, pause count ${input.hesitationCount}`;

export async function analyzePracticeSpeech(input: AnalyzePracticeSpeechInput): Promise<AiFeedbackResult> {
  try {
    const trimmed = input.transcript.trim();
    if (!trimmed) {
      throw new Error("Transcript is empty");
    }

    const topic = input.topic?.trim();
    const hasTopic = !!topic;
    const hesitationCount = input.hesitationCount ?? 0;
    const speakingTime = input.speakingTime ?? 0;
    const wordCount = input.wordCount ?? 0;

    console.log("analyzeSpeech request", {
      transcriptLength: trimmed.length,
      hesitationCount,
      speakingTime,
      wordCount,
      hasTopic,
    });

    const raw = await getAIFeedback(
      buildPracticeFeedbackUserMessage({
        topic,
        transcript: trimmed,
        hesitationCount,
        speakingTime,
        wordCount,
      }),
      hasTopic ? FEEDBACK_SYSTEM_PROMPT : FREE_SPEECH_SYSTEM_PROMPT,
    );
    const result = parseAiFeedbackResponse(raw);

    console.log("analyzeSpeech response", { responseLength: result.feedback.length, band: result.band });
    return result;
  } catch (error) {
    console.error("Groq analyzeSpeech failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: input.transcript.length,
    });
    throw error;
  }
}
