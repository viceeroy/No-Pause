import { mutation } from "./_generated/server";
import { v } from "convex/values";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const dayNumberUtc = (timestamp: number) => Math.floor(timestamp / DAY_IN_MS);

export const updateStreak = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const today = dayNumberUtc(now);

    const existing = await ctx.db
      .query("streaks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!existing) {
      await ctx.db.insert("streaks", {
        userId: args.userId,
        currentStreak: 1,
        lastPracticeDate: now,
      });
      return;
    }

    const lastPracticeDay = dayNumberUtc(existing.lastPracticeDate);
    if (lastPracticeDay === today) {
      return;
    }

    const nextStreak =
      lastPracticeDay === today - 1 ? existing.currentStreak + 1 : 1;

    await ctx.db.patch(existing._id, {
      currentStreak: nextStreak,
      lastPracticeDate: now,
    });
  },
});
