import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveSession = mutation({
  args: {
    userId: v.string(),
    duration: v.number(),
    pauses: v.number(),
    words: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sessions", {
      userId: args.userId,
      duration: args.duration,
      pauses: args.pauses,
      words: args.words,
      createdAt: Date.now(),
    });
  },
});

export const getUserStats = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const totalSessions = sessions.length;

    return {
      totalSessions,
      totalSpeakingTime: 0,
      totalPauses: 0,
      averagePausesPerSession: 0,
    };
  },
});

export const getSessions = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    sessions.sort((a, b) => b.createdAt - a.createdAt);
    return sessions.slice(0, 20);
  },
});
