import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const heartbeat = mutation({
  args: {
    agentName: v.string(),
    sessionKey: v.string(),
    currentTask: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agentSessions")
      .withIndex("by_agent", (q) => q.eq("agentName", args.agentName))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "active",
        lastHeartbeat: now,
        currentTask: args.currentTask,
        sessionKey: args.sessionKey,
      });
    } else {
      await ctx.db.insert("agentSessions", {
        agentName: args.agentName,
        sessionKey: args.sessionKey,
        status: "active",
        lastHeartbeat: now,
        currentTask: args.currentTask,
      });
    }
  },
});

export const setIdle = mutation({
  args: { agentName: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("agentSessions")
      .withIndex("by_agent", (q) => q.eq("agentName", args.agentName))
      .first();

    if (session) {
      await ctx.db.patch(session._id, {
        status: "idle",
        currentTask: undefined,
      });
    }
  },
});

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("agentSessions").collect();
    const now = Date.now();
    const TIMEOUT = 5 * 60 * 1000; // 5 minutes

    return sessions.map((s) => ({
      ...s,
      status: now - s.lastHeartbeat > TIMEOUT ? "offline" : s.status,
    }));
  },
});

export const getMessages = query({
  args: { agentName: v.string() },
  handler: async (ctx, args) => {
    const direct = await ctx.db
      .query("messages")
      .withIndex("by_recipient", (q) => q.eq("to", args.agentName))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();

    const broadcast = await ctx.db
      .query("messages")
      .withIndex("by_recipient", (q) => q.eq("to", "all"))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();

    return [...direct, ...broadcast].sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const sendMessage = mutation({
  args: {
    from: v.string(),
    to: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      ...args,
      read: false,
      createdAt: Date.now(),
    });
  },
});

export const markMessageRead = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { read: true });
  },
});
