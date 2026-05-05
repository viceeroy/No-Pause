import { supabaseServer } from "../services/supabaseServer.js";

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    (
      ("status" in error && error.status === 409) ||
      ("code" in error && typeof error.code === "string" && error.code.startsWith("23")) ||
      ("message" in error && typeof error.message === "string" && error.message.toLowerCase().includes("duplicate"))
    ),
  );
}

export async function upsertTelegramConnection(input: { telegramId: number; userId: string }) {
  const connectedAt = new Date().toISOString();
  const { error: insertError } = await supabaseServer.from("telegram_connections").insert({
    telegram_id: input.telegramId,
    user_id: input.userId,
    connected_at: connectedAt,
  });

  if (!insertError) {
    return { shouldSendWelcome: true };
  }

  if (!isUniqueViolation(insertError)) {
    throw insertError;
  }

  const { data: existingConnection, error: existingConnectionError } = await supabaseServer
    .from("telegram_connections")
    .select("user_id")
    .eq("telegram_id", input.telegramId)
    .maybeSingle();

  if (existingConnectionError) {
    throw existingConnectionError;
  }

  if (existingConnection?.user_id === input.userId) {
    return { shouldSendWelcome: false };
  }

  const { error: updateError } = await supabaseServer
    .from("telegram_connections")
    .update({
      user_id: input.userId,
      connected_at: connectedAt,
    })
    .eq("telegram_id", input.telegramId);

  if (updateError) {
    throw updateError;
  }

  return { shouldSendWelcome: true };
}
