import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    userId: v.string(),
    email: v.optional(v.string()),
    duration: v.number(),
    pauses: v.number(),
    words: v.number(),
    mode: v.optional(v.string()),
    flowScore: v.optional(v.number()),
    completed: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  streaks: defineTable({
    userId: v.string(),
    email: v.optional(v.string()),
    currentStreak: v.number(),
    bestStreak: v.optional(v.number()),
    lastPracticeDate: v.number(),
  }).index("by_userId", ["userId"]),
});
