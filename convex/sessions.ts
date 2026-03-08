import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveSession = mutation({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
    duration: v.number(),
    pauses: v.number(),
    words: v.number(),
    mode: v.string(),
    flowScore: v.optional(v.number()),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    if (identity.subject !== args.userId) throw new Error("Forbidden");

    await ctx.db.insert("sessions", {
      userId: args.userId,
      email: args.email,
      duration: args.duration,
      pauses: args.pauses,
      words: args.words,
      mode: args.mode,
      flowScore: args.flowScore,
      completed: args.completed,
      createdAt: Date.now(),
    });
  },
});

export const getUserStats = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    if (identity.subject !== args.userId) throw new Error("Forbidden");

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
    const scoredSessions = sessions.filter((session) => session.completed === true);
    const flowScoredSessions = scoredSessions.filter(
      (session) => session.flowScore !== undefined && session.flowScore > 0,
    );
    const avgFlowScore =
      flowScoredSessions.length > 0
        ? Math.round(
            flowScoredSessions.reduce(
              (sum, session) => sum + (session.flowScore ?? 0),
              0,
            ) / flowScoredSessions.length,
          )
        : 0;

    return {
      totalSessions,
      scoredSessions: scoredSessions.length,
      totalSpeakingTime,
      totalPauses,
      averagePausesPerSession,
      avgFlowScore,
    };
  },
});

export const getSessions = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    if (identity.subject !== args.userId) throw new Error("Forbidden");

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    sessions.sort((a, b) => b.createdAt - a.createdAt);
    return sessions.slice(0, 20);
  },
});
