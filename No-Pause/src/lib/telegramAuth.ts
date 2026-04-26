import { supabaseServer } from "./supabaseServer.js";
import { resolveTelegramUser } from "./core/user.js";

export async function getTelegramConnection(telegramId: number) {
  const userId = await resolveTelegramUser(telegramId);
  return userId ? { userId } : null;
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
