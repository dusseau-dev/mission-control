import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
  args: {
    limit: v.optional(v.number()),
    agentName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    let activities;
    if (args.agentName) {
      activities = await ctx.db
        .query("activities")
        .withIndex("by_agent", (q) => q.eq("agentName", args.agentName!))
        .order("desc")
        .take(limit);
    } else {
      activities = await ctx.db
        .query("activities")
        .order("desc")
        .take(limit);
    }

    return activities;
  },
});
