import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {
    type: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.type) {
      return await ctx.db
        .query("documents")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .collect();
    }
    if (args.createdBy) {
      return await ctx.db
        .query("documents")
        .withIndex("by_creator", (q) => q.eq("createdBy", args.createdBy!))
        .collect();
    }
    return await ctx.db.query("documents").collect();
  },
});

export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    type: v.string(),
    createdBy: v.string(),
    taskId: v.optional(v.id("tasks")),
    filePath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const docId = await ctx.db.insert("documents", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("activities", {
      agentName: args.createdBy,
      action: "created_document",
      targetType: "document",
      targetId: docId,
      details: `Created document: ${args.title}`,
      createdAt: now,
    });

    return docId;
  },
});

export const update = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    agentName: v.string(),
  },
  handler: async (ctx, args) => {
    const { id, agentName, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });

    const doc = await ctx.db.get(id);
    await ctx.db.insert("activities", {
      agentName,
      action: "updated_document",
      targetType: "document",
      targetId: id,
      details: `Updated document: ${doc?.title}`,
      createdAt: Date.now(),
    });

    return id;
  },
});
