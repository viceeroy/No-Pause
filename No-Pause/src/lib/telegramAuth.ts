import { supabaseServer } from "./supabaseServer.js";

export async function getTelegramConnection(telegramId: number) {
  const { data, error } = await supabaseServer
    .from("telegram_connections")
    .select("user_id")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.user_id ? { userId: String(data.user_id) } : null;
}

export async function upsertTelegramConnection(input: { telegramId: number; userId: string }) {
  const { error } = await supabaseServer.from("telegram_connections").upsert(
    {
      telegram_id: input.telegramId,
      user_id: input.userId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "telegram_id" },
  );

  if (error) {
    throw error;
  }
}
