import { supabaseServer } from "./supabaseServer.js";

export type ApiUsageKind = "transcription" | "feedback" | "prompts";

export const DAILY_TRANSCRIPTION_LIMIT = 20;
export const DAILY_FEEDBACK_LIMIT = 20;
export const DAILY_PROMPTS_LIMIT = 20;

export class ApiQuotaExceededError extends Error {
  constructor(public readonly kind: ApiUsageKind) {
    super(`${kind} quota exceeded`);
    this.name = "ApiQuotaExceededError";
  }
}

export function isApiQuotaExceededError(error: unknown): error is ApiQuotaExceededError {
  return error instanceof ApiQuotaExceededError;
}

export function getQuotaExceededMessage(kind: ApiUsageKind): string {
  switch (kind) {
    case "transcription":
      return "Daily transcription limit reached. Try again tomorrow.";
    case "prompts":
      return "Daily prompt generation limit reached. Try again tomorrow.";
    case "feedback":
    default:
      return "Daily feedback limit reached. Try again tomorrow.";
  }
}

export async function consumeApiQuota(input: {
  userId: string;
  kind: ApiUsageKind;
  limit: number;
}): Promise<void> {
  const { data, error } = await supabaseServer.rpc("consume_api_usage_daily", {
    p_user_id: input.userId,
    p_kind: input.kind,
    p_limit: input.limit,
  });

  if (error) {
    throw error;
  }

  if (data !== true) {
    throw new ApiQuotaExceededError(input.kind);
  }
}
