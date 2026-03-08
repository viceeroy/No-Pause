import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const dayNumberUtc = (timestamp: number) => Math.floor(timestamp / DAY_IN_MS);

export const updateStreak = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

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

export const getStreak = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const existing = await ctx.db
      .query("streaks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!existing) {
      return {
        currentStreak: 0,
        lastPracticeDate: null as number | null,
      };
    }

    return {
      currentStreak: existing.currentStreak,
      lastPracticeDate: existing.lastPracticeDate,
    };
  },
});
