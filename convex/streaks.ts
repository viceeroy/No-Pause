import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const updateStreak = mutation({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const now = Date.now();
    const today = Math.floor(now / DAY_IN_MS);

    const existing = await ctx.db
      .query("streaks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!existing) {
      await ctx.db.insert("streaks", {
        userId: args.userId,
        email: args.email,
        currentStreak: 1,
        lastPracticeDate: now,
      });
      return;
    }

    const lastDay = Math.floor(existing.lastPracticeDate / DAY_IN_MS);
    const nextStreak = lastDay === today - 1 ? existing.currentStreak + 1 : 1;

    await ctx.db.patch(existing._id, {
      email: args.email ?? existing.email,
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
    if (!identity) throw new Error("Unauthenticated");

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
