import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("review"),
        v.literal("completed"),
        v.literal("blocked")
      )
    ),
    assignedTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let tasks;
    if (args.status) {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else if (args.assignedTo) {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_assignee", (q) => q.eq("assignedTo", args.assignedTo))
        .collect();
    } else {
      tasks = await ctx.db.query("tasks").collect();
    }
    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    assignedTo: v.optional(v.string()),
    createdBy: v.string(),
    parentTaskId: v.optional(v.id("tasks")),
    tags: v.array(v.string()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      ...args,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Log activity
    await ctx.db.insert("activities", {
      agentName: args.createdBy,
      action: "created_task",
      targetType: "task",
      targetId: taskId,
      details: `Created task: ${args.title}`,
      createdAt: now,
    });

    return taskId;
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("review"),
        v.literal("completed"),
        v.literal("blocked")
      )
    ),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent")
      )
    ),
    assignedTo: v.optional(v.string()),
    agentName: v.string(),
  },
  handler: async (ctx, args) => {
    const { id, agentName, ...updates } = args;
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");

    const now = Date.now();
    await ctx.db.patch(id, { ...updates, updatedAt: now });

    // Log activity
    const changes = Object.entries(updates)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    await ctx.db.insert("activities", {
      agentName,
      action: args.status === "completed" ? "completed_task" : "updated_task",
      targetType: "task",
      targetId: id,
      details: `Updated task "${task.title}": ${changes}`,
      createdAt: now,
    });

    return id;
  },
});

export const addComment = mutation({
  args: {
    taskId: v.id("tasks"),
    agentName: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Extract @mentions from content
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(args.content)) !== null) {
      mentions.push(match[1].toLowerCase());
    }

    const commentId = await ctx.db.insert("comments", {
      taskId: args.taskId,
      agentName: args.agentName,
      content: args.content,
      mentions,
      createdAt: now,
    });

    // Log activity
    await ctx.db.insert("activities", {
      agentName: args.agentName,
      action: "commented",
      targetType: "task",
      targetId: args.taskId,
      details: args.content.slice(0, 100),
      createdAt: now,
    });

    // Send notifications to mentioned agents
    for (const mention of mentions) {
      await ctx.db.insert("messages", {
        from: args.agentName,
        to: mention,
        content: `You were mentioned in a comment: "${args.content.slice(0, 100)}..."`,
        read: false,
        createdAt: now,
      });
    }

    return commentId;
  },
});

export const getComments = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("comments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
  },
});
