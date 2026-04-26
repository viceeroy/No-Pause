import { supabaseServer } from "../supabaseServer.js";

export async function resolveTelegramUser(telegramId: number): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from("telegram_connections")
    .select("user_id")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.user_id ? String(data.user_id) : null;
}
