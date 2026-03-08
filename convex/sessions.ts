import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveSession = mutation({
  args: {
    userId: v.string(),
    duration: v.number(),
    pauses: v.number(),
    words: v.number(),
    mode: v.string(),
    flowScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sessions", {
      userId: args.userId,
      duration: args.duration,
      pauses: args.pauses,
      words: args.words,
      mode: args.mode,
      flowScore: args.flowScore,
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
    const totalSpeakingTime = sessions.reduce(
      (sum, session) => sum + session.duration,
      0,
    );
    const totalPauses = sessions.reduce((sum, session) => sum + session.pauses, 0);
    const averagePausesPerSession =
      totalSessions === 0 ? 0 : totalPauses / totalSessions;

    return {
      totalSessions,
      totalSpeakingTime,
      totalPauses,
      averagePausesPerSession,
    };
  },
});

export const getSessions = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    sessions.sort((a, b) => b.createdAt - a.createdAt);
    return sessions.slice(0, 20);
  },
});
