import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Tasks shared across all agents
  tasks: defineTable({
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("completed"),
      v.literal("blocked")
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    assignedTo: v.optional(v.string()), // agent name
    createdBy: v.string(), // agent name
    parentTaskId: v.optional(v.id("tasks")),
    tags: v.array(v.string()),
    dueDate: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_assignee", ["assignedTo"])
    .index("by_creator", ["createdBy"]),

  // Comments on tasks
  comments: defineTable({
    taskId: v.id("tasks"),
    agentName: v.string(),
    content: v.string(),
    mentions: v.array(v.string()), // @agent mentions
    createdAt: v.number(),
  }).index("by_task", ["taskId"]),

  // Activity feed for real-time visibility
  activities: defineTable({
    agentName: v.string(),
    action: v.string(), // e.g., "created_task", "completed_task", "commented"
    targetType: v.string(), // e.g., "task", "document"
    targetId: v.optional(v.string()),
    details: v.string(),
    createdAt: v.number(),
  }).index("by_agent", ["agentName"]),

  // Agent sessions and heartbeats
  agentSessions: defineTable({
    agentName: v.string(),
    sessionKey: v.string(),
    status: v.union(v.literal("active"), v.literal("idle"), v.literal("offline")),
    lastHeartbeat: v.number(),
    currentTask: v.optional(v.string()),
  }).index("by_agent", ["agentName"]),

  // Shared documents/deliverables
  documents: defineTable({
    title: v.string(),
    content: v.string(),
    type: v.string(), // e.g., "analysis", "content", "design"
    createdBy: v.string(),
    taskId: v.optional(v.id("tasks")),
    filePath: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_creator", ["createdBy"]),

  // Messages between agents
  messages: defineTable({
    from: v.string(),
    to: v.string(), // agent name or "all" for broadcast
    content: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_recipient", ["to"])
    .index("by_sender", ["from"]),
});
