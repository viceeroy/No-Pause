import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    userId: v.string(),
    duration: v.number(),
    pauses: v.number(),
    words: v.number(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  streaks: defineTable({
    userId: v.string(),
    currentStreak: v.number(),
    lastPracticeDate: v.number(),
  }).index("by_userId", ["userId"]),
});
