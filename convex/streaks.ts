import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const updateStreak = mutation({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
    // Client sends their local calendar date as "YYYY-MM-DD" so streak
    // day comparison respects the user's timezone instead of UTC.
    localDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    if (identity.subject !== args.userId) throw new Error("Forbidden");

    const now = Date.now();
    // Use client-provided local date string for day comparison.
    // Format: "YYYY-MM-DD" — produced by new Date().toLocaleDateString('en-CA')
    const todayStr = args.localDate || new Date(now).toISOString().slice(0, 10);

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
        lastPracticeDateStr: todayStr,
      });
      return;
    }

    // Compare using local date strings for timezone-correct streak logic.
    // Fall back to stored lastPracticeDateStr, or derive from the UTC timestamp.
    const lastDateStr =
      existing.lastPracticeDateStr ||
      new Date(existing.lastPracticeDate).toISOString().slice(0, 10);

    // Same day — streak already counted, just update timestamp
    if (lastDateStr === todayStr) {
      await ctx.db.patch(existing._id, {
        email: args.email ?? existing.email,
        lastPracticeDate: now,
        lastPracticeDateStr: todayStr,
      });
      return;
    }

    // Check if lastDateStr is "yesterday" relative to todayStr.
    // Parse both dates and check if the difference is exactly 1 calendar day.
    const todayDate = new Date(todayStr + "T00:00:00");
    const lastDate = new Date(lastDateStr + "T00:00:00");
    const diffMs = todayDate.getTime() - lastDate.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    const isConsecutive = diffDays === 1;

    const nextStreak = isConsecutive ? existing.currentStreak + 1 : 1;
    const newBest = Math.max(existing.bestStreak ?? 0, nextStreak);

    await ctx.db.patch(existing._id, {
      email: args.email ?? existing.email,
      currentStreak: nextStreak,
      bestStreak: newBest,
      lastPracticeDate: now,
      lastPracticeDateStr: todayStr,
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

    // If bestStreak is missing or 0, backfill from session history.
    let bestStreak = existing.bestStreak ?? 0;
    if (bestStreak === 0) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect();

      if (sessions.length > 0) {
        // Extract unique calendar days (UTC-based fallback, best we can do retroactively)
        const daySet = new Set(
          sessions.map((s) => new Date(s.createdAt).toISOString().slice(0, 10)),
        );
        const sortedDays = [...daySet].sort();

        let currentRun = 1;
        let maxRun = 1;
        for (let i = 1; i < sortedDays.length; i++) {
          const prev = new Date(sortedDays[i - 1] + "T00:00:00");
          const curr = new Date(sortedDays[i] + "T00:00:00");
          const diff = Math.round(
            (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000),
          );
          if (diff === 1) {
            currentRun++;
            if (currentRun > maxRun) maxRun = currentRun;
          } else {
            currentRun = 1;
          }
        }
        bestStreak = maxRun;
      }
    }

    return {
      currentStreak: existing.currentStreak,
      bestStreak,
      lastPracticeDate: existing.lastPracticeDate,
    };
  },
});
