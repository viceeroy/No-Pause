import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveSession = mutation({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
    duration: v.number(),
    speakingTime: v.optional(v.number()),
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
      speakingTime: args.speakingTime,
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
    const totalPauses = sessions.reduce((sum, session) => sum + session.pauses, 0);
    const averagePausesPerSession =
      totalSessions === 0 ? 0 : totalPauses / totalSessions;
    const scoredSessions = sessions.filter((session) => {
      if (session.flowScore === undefined || session.flowScore <= 0) return false;
      const mode = (session.mode || "").toLowerCase();
      return mode === "lemon" || mode === "topic";
    });
    const totalSpeakingTime = scoredSessions.reduce(
      (sum, session) => sum + (session.speakingTime ?? 0),
      0,
    );
    const flowScoredSessions = scoredSessions;
    // Duration-weighted average: longer sessions carry more weight,
    // capped at 300s (5 min) to prevent outlier dominance.
    const MAX_WEIGHT = 300;
    let weightedSum = 0;
    let totalWeight = 0;
    for (const session of flowScoredSessions) {
      const weight = Math.min(Math.max(session.duration, 1), MAX_WEIGHT);
      weightedSum += (session.flowScore ?? 0) * weight;
      totalWeight += weight;
    }
    const avgFlowScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

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

    const scoredSessions = sessions.filter((session) => {
      if (session.flowScore === undefined || session.flowScore <= 0) return false;
      const mode = (session.mode || "").toLowerCase();
      return mode === "lemon" || mode === "topic";
    });

    scoredSessions.sort((a, b) => b.createdAt - a.createdAt);
    return scoredSessions.slice(0, 20);
  },
});
