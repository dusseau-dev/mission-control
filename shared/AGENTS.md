# Mission Control - Agent Operating Manual

This document defines how all agents in Mission Control operate. Every agent must follow these guidelines.

## 1. Mission Control System

Mission Control is your shared workspace. All agents see the same:
- **Tasks**: Work items with status, priority, and assignments
- **Comments**: Discussion threads on tasks
- **Activity Feed**: Real-time log of all agent actions
- **Documents**: Deliverables and shared files
- **Messages**: Direct communication between agents

## 2. Task Management

### Task Statuses
- `pending` - Not started
- `in_progress` - Currently being worked on
- `review` - Completed, awaiting review
- `completed` - Done
- `blocked` - Cannot proceed, needs input

### Task Priorities
- `urgent` - Drop everything, do this now
- `high` - Important, do soon
- `medium` - Normal priority
- `low` - Do when possible

### Working with Tasks

**When assigned a task:**
1. Mark it `in_progress` immediately
2. Post a comment with your approach
3. Work on it
4. Post updates for long tasks
5. Mark `review` or `completed` when done

**When blocked:**
1. Mark the task `blocked`
2. Post a comment explaining the blocker
3. @mention the person who can help
4. Do NOT silently wait

## 3. Communication Protocol

### Using @mentions
- `@jarvis` - Escalate or delegate to squad lead
- `@shuri` - Product analysis needed
- `@fury` - Customer research needed
- `@vision` - SEO input needed
- `@loki` - Content writing needed
- `@quill` - Social content needed
- `@wanda` - Design input needed
- `@all` - Broadcast to everyone

### Comment Guidelines
- Be specific about what you need
- Include relevant context
- If asking for help, explain what you've tried
- Keep comments focused on the task

## 4. File Storage

### Directory Structure
```
/deliverables
  /analysis      - Research and analysis documents
  /content       - Written content
  /design        - Visual assets
  /social        - Social media content

/sessions
  /{agent-name}  - Agent session files
```

### Naming Convention
- Use descriptive names: `competitor-analysis-acme.md`
- Include dates for versioned files: `weekly-report-2024-01-15.md`
- No spaces in filenames, use hyphens

## 5. Working Hours

Each agent wakes on a 15-minute cycle, staggered:
- `:00` - Jarvis, Shuri
- `:05` - Fury, Vision
- `:10` - Loki, Quill
- `:15` - Wanda

When you wake:
1. Check for messages and mentions
2. Check assigned tasks
3. Process highest priority items
4. Update task status
5. Post activity summary if you did work

## 6. Decision Making

### What to do yourself
- Tasks clearly in your domain
- Tasks assigned directly to you
- Quick questions you can answer

### What to delegate
- Tasks outside your expertise
- Tasks that need specialist input
- Anything you're unsure about

### When to escalate to Jarvis
- Unclear requirements
- Conflicting priorities
- Resource conflicts
- Blocked with no clear path forward

## 7. Quality Standards

### Before marking a task complete:
- [ ] Deliverable meets the requirements
- [ ] Work is documented appropriately
- [ ] Files are in the correct location
- [ ] Relevant parties are notified

### For content:
- [ ] Proofread for errors
- [ ] Matches requested tone/style
- [ ] SEO optimized (if applicable)

### For analysis:
- [ ] Sources are cited
- [ ] Conclusions are supported by data
- [ ] Actionable recommendations included

## 8. Emergency Protocol

If something is breaking or urgent:
1. Post to activity feed immediately
2. @mention Jarvis
3. Mark related tasks as blocked
4. Include all relevant details

## 9. Session Keys

Each agent has a unique session identifier:
- `agent:main:main` - Jarvis
- `agent:product-analyst:main` - Shuri
- `agent:customer-researcher:main` - Fury
- `agent:seo-analyst:main` - Vision
- `agent:content-writer:main` - Loki
- `agent:social-media-manager:main` - Quill
- `agent:designer:main` - Wanda

## 10. Memory & Context

- Your session memory persists across runs
- You can search your conversation history
- Reference previous work when relevant
- Don't repeat analysis you've already done
