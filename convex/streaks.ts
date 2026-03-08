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
    if (identity.subject !== args.userId) throw new Error("Forbidden");

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
        bestStreak: 1,
        lastPracticeDate: now,
      });
      return;
    }

    const lastDay = Math.floor(existing.lastPracticeDate / DAY_IN_MS);
    const nextStreak = lastDay === today - 1 ? existing.currentStreak + 1 : 1;
    const newBest = Math.max(existing.bestStreak ?? 0, nextStreak);

    await ctx.db.patch(existing._id, {
      email: args.email ?? existing.email,
      currentStreak: nextStreak,
      bestStreak: newBest,
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
    if (identity.subject !== args.userId) throw new Error("Forbidden");

    const existing = await ctx.db
      .query("streaks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!existing) {
      return {
        currentStreak: 0,
        bestStreak: 0,
        lastPracticeDate: null as number | null,
      };
    }

    return {
      currentStreak: existing.currentStreak,
      bestStreak: existing.bestStreak ?? 0,
      lastPracticeDate: existing.lastPracticeDate,
    };
  },
});
