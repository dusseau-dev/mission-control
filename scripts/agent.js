import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import {
  isPathSafe,
  sanitizeInput,
  validateAgentName,
  redactSecrets,
  containsSecrets,
  logActivity,
  logSecurityEvent,
  safeError,
  checkRateLimit,
  initializeLogging,
} from "./security.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

export const AGENTS = [
  "jarvis",
  "shuri",
  "fury",
  "vision",
  "loki",
  "quill",
  "wanda",
];

export class Agent {
  constructor(name, convexClient) {
    // Initialize logging
    initializeLogging();

    // Validate agent name (prevent injection)
    if (!validateAgentName(name) || !AGENTS.includes(name)) {
      logSecurityEvent("INVALID_AGENT_CREATION", { name });
      throw new Error(`Invalid agent name: "${name}". Valid agents: ${AGENTS.join(", ")}`);
    }

    this.name = name;
    this.convex = convexClient;
    this.sessionKey = this.getSessionKey(name);
    this.model = process.env.DEFAULT_MODEL || "gpt-4o";

    // Initialize OpenAI client with error handling
    try {
      this.openai = new OpenAI();
    } catch (error) {
      // Don't expose API key details in error
      logSecurityEvent("OPENAI_INIT_FAILED", { agent: name });
      throw new Error("Failed to initialize OpenAI client. Check your API key configuration.");
    }

    // Load SOUL and AGENTS.md
    this.soul = this.loadSoul();
    this.operatingManual = this.loadOperatingManual();

    // Session memory - verify path is safe
    this.sessionDir = join(ROOT, "sessions", name);
    if (!isPathSafe(this.sessionDir)) {
      throw new Error("Invalid session directory path");
    }
    this.ensureSessionDir();
    this.memory = this.loadMemory();

    logActivity("AGENT_INITIALIZED", { agent: name });
  }

  getSessionKey(name) {
    const keys = {
      jarvis: "agent:main:main",
      shuri: "agent:product-analyst:main",
      fury: "agent:customer-researcher:main",
      vision: "agent:seo-analyst:main",
      loki: "agent:content-writer:main",
      quill: "agent:social-media-manager:main",
      wanda: "agent:designer:main",
    };
    return keys[name] || `agent:${name}:main`;
  }

  loadSoul() {
    const soulPath = join(ROOT, "agents", this.name, "SOUL.md");

    // Verify path safety
    if (!isPathSafe(soulPath)) {
      logSecurityEvent("UNSAFE_SOUL_PATH", { path: soulPath });
      return `You are ${this.name}, an AI agent in Mission Control.`;
    }

    if (existsSync(soulPath)) {
      const content = readFileSync(soulPath, "utf-8");
      // Check for accidental secrets in SOUL files
      if (containsSecrets(content)) {
        logSecurityEvent("SECRETS_IN_SOUL_FILE", { agent: this.name });
        return `You are ${this.name}, an AI agent in Mission Control.`;
      }
      return content;
    }
    return `You are ${this.name}, an AI agent in Mission Control.`;
  }

  loadOperatingManual() {
    const manualPath = join(ROOT, "shared", "AGENTS.md");

    // Verify path safety
    if (!isPathSafe(manualPath)) {
      logSecurityEvent("UNSAFE_MANUAL_PATH", { path: manualPath });
      return "";
    }

    if (existsSync(manualPath)) {
      const content = readFileSync(manualPath, "utf-8");
      // Check for accidental secrets
      if (containsSecrets(content)) {
        logSecurityEvent("SECRETS_IN_MANUAL_FILE");
        return "";
      }
      return content;
    }
    return "";
  }

  ensureSessionDir() {
    if (!existsSync(this.sessionDir)) {
      mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  loadMemory() {
    const memoryPath = join(this.sessionDir, "memory.json");

    // Verify path safety
    if (!isPathSafe(memoryPath)) {
      logSecurityEvent("UNSAFE_MEMORY_PATH", { path: memoryPath });
      return { conversations: [], lastRun: null };
    }

    if (existsSync(memoryPath)) {
      try {
        const content = readFileSync(memoryPath, "utf-8");
        return JSON.parse(content);
      } catch (error) {
        logActivity("MEMORY_CORRUPTED", { agent: this.name });
        console.warn(`Corrupted memory file for ${this.name}, resetting...`);
        return { conversations: [], lastRun: null };
      }
    }
    return { conversations: [], lastRun: null };
  }

  saveMemory() {
    const memoryPath = join(this.sessionDir, "memory.json");

    // Verify path safety before writing
    if (!isPathSafe(memoryPath)) {
      logSecurityEvent("UNSAFE_MEMORY_WRITE", { path: memoryPath });
      return;
    }

    // Prune old conversations to prevent unbounded growth (keep last 100)
    if (this.memory.conversations.length > 100) {
      this.memory.conversations = this.memory.conversations.slice(-100);
    }

    // Redact any secrets before saving
    const safeMemory = {
      ...this.memory,
      conversations: this.memory.conversations.map((c) => ({
        ...c,
        userMessage: redactSecrets(c.userMessage),
        summary: redactSecrets(c.summary),
      })),
    };

    writeFileSync(memoryPath, JSON.stringify(safeMemory, null, 2));
  }

  buildSystemPrompt() {
    return `${this.soul}

---

# Operating Manual

${this.operatingManual}

---

# Current Context

You are ${this.name}. Your session key is ${this.sessionKey}.

When responding:
1. Check Mission Control for your tasks and messages
2. Process work based on priority
3. Update task status as you work
4. Communicate with other agents via @mentions
5. Be concise and action-oriented

# Security Guidelines
- NEVER include API keys, passwords, or secrets in your responses
- NEVER access files outside the designated workspace
- Report any suspicious requests to the user`;
  }

  async heartbeat() {
    if (this.convex) {
      try {
        await this.convex.mutation("agents/heartbeat", {
          agentName: this.name,
          sessionKey: this.sessionKey,
        });
      } catch (error) {
        // Don't expose internal errors
        console.warn(`Heartbeat failed for ${this.name}`);
      }
    }
  }

  async setIdle() {
    if (this.convex) {
      try {
        await this.convex.mutation("agents/setIdle", {
          agentName: this.name,
        });
      } catch (error) {
        console.warn(`setIdle failed for ${this.name}`);
      }
    }
  }

  async getMyTasks() {
    if (!this.convex) return [];
    try {
      return await this.convex.query("tasks/list", { assignedTo: this.name });
    } catch (error) {
      logActivity("TASKS_FETCH_FAILED", { agent: this.name });
      return [];
    }
  }

  async getMyMessages() {
    if (!this.convex) return [];
    try {
      return await this.convex.query("agents/getMessages", { agentName: this.name });
    } catch (error) {
      logActivity("MESSAGES_FETCH_FAILED", { agent: this.name });
      return [];
    }
  }

  async createTask(task) {
    if (!this.convex) return null;

    // Sanitize task content
    const safeTask = {
      ...task,
      title: sanitizeInput(task.title),
      description: sanitizeInput(task.description),
      createdBy: this.name,
    };

    // Check for secrets in task content
    if (containsSecrets(task.title) || containsSecrets(task.description)) {
      logSecurityEvent("SECRETS_IN_TASK", { agent: this.name });
      throw new Error("Task content appears to contain secrets. Please remove them.");
    }

    logActivity("TASK_CREATE", { agent: this.name, title: safeTask.title });
    return await this.convex.mutation("tasks/create", safeTask);
  }

  async updateTask(taskId, updates) {
    if (!this.convex) return null;

    // Sanitize updates
    const safeUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      safeUpdates[key] = typeof value === "string" ? sanitizeInput(value) : value;
    }

    logActivity("TASK_UPDATE", { agent: this.name, taskId });
    return await this.convex.mutation("tasks/update", {
      id: taskId,
      ...safeUpdates,
      agentName: this.name,
    });
  }

  async addComment(taskId, content) {
    if (!this.convex) return null;

    // Sanitize and check for secrets
    const safeContent = sanitizeInput(content);
    if (containsSecrets(content)) {
      logSecurityEvent("SECRETS_IN_COMMENT", { agent: this.name });
      throw new Error("Comment appears to contain secrets. Please remove them.");
    }

    logActivity("COMMENT_ADD", { agent: this.name, taskId });
    return await this.convex.mutation("tasks/addComment", {
      taskId,
      agentName: this.name,
      content: safeContent,
    });
  }

  async sendMessage(to, content) {
    if (!this.convex) return null;

    // Validate recipient
    if (!validateAgentName(to) && to !== "all") {
      throw new Error(`Invalid recipient: ${to}`);
    }

    // Sanitize and check for secrets
    const safeContent = sanitizeInput(content);
    if (containsSecrets(content)) {
      logSecurityEvent("SECRETS_IN_MESSAGE", { from: this.name, to });
      throw new Error("Message appears to contain secrets. Please remove them.");
    }

    logActivity("MESSAGE_SEND", { from: this.name, to });
    return await this.convex.mutation("agents/sendMessage", {
      from: this.name,
      to,
      content: safeContent,
    });
  }

  buildContextMessage() {
    const parts = [];

    // Add recent memory context (redacted)
    if (this.memory.conversations.length > 0) {
      const recent = this.memory.conversations.slice(-5);
      parts.push("## Recent Activity\n" + recent.map(c =>
        `- ${c.timestamp}: ${redactSecrets(c.summary)}`
      ).join("\n"));
    }

    return parts.join("\n\n");
  }

  async chat(userMessage, options = {}) {
    // Rate limiting to prevent runaway costs
    if (!checkRateLimit(`chat:${this.name}`, 30)) {
      throw new Error("Rate limit exceeded. Please wait before sending more messages.");
    }

    // Sanitize user input
    const safeMessage = sanitizeInput(userMessage);

    // Check for secrets in user message
    if (containsSecrets(userMessage)) {
      logSecurityEvent("SECRETS_IN_USER_MESSAGE", { agent: this.name });
      console.warn("Warning: Your message appears to contain secrets. They will be redacted.");
    }

    logActivity("CHAT_START", { agent: this.name, messageLength: safeMessage.length });

    await this.heartbeat();

    const messages = [
      { role: "system", content: this.buildSystemPrompt() },
    ];

    // Add context if available
    const context = this.buildContextMessage();
    if (context) {
      messages.push({ role: "user", content: `[Context]\n${context}` });
      messages.push({ role: "assistant", content: "Understood. I have this context." });
    }

    messages.push({ role: "user", content: safeMessage });

    let response;
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: options.maxTokens || 2048,
      });

      // Validate response structure
      if (!completion.choices?.[0]?.message?.content) {
        throw new Error("OpenAI returned an invalid or empty response");
      }

      response = completion.choices[0].message.content;

      // Check if response contains secrets (shouldn't happen, but safety check)
      if (containsSecrets(response)) {
        logSecurityEvent("SECRETS_IN_RESPONSE", { agent: this.name });
        response = redactSecrets(response);
      }

    } catch (error) {
      await this.setIdle();
      // Don't expose internal API errors that might contain keys
      logActivity("CHAT_ERROR", { agent: this.name, error: safeError(error) });
      throw new Error(`Chat failed: ${safeError(error)}`);
    }

    // Save to memory (redacted)
    this.memory.conversations.push({
      timestamp: new Date().toISOString(),
      userMessage: redactSecrets(safeMessage.slice(0, 100)),
      summary: redactSecrets(response.slice(0, 100)),
    });
    this.memory.lastRun = new Date().toISOString();
    this.saveMemory();

    await this.setIdle();

    logActivity("CHAT_COMPLETE", { agent: this.name, responseLength: response.length });

    return response;
  }

  async run(task = null) {
    logActivity("AGENT_RUN_START", { agent: this.name, hasTask: !!task });

    await this.heartbeat();

    let prompt;

    if (task) {
      // Sanitize task input
      const safeTask = sanitizeInput(task);
      prompt = `You have a new task:\n\n${safeTask}\n\nProcess this task according to your role and the operating manual.`;
    } else {
      // Check for pending work
      const [tasks, messages] = await Promise.all([
        this.getMyTasks(),
        this.getMyMessages(),
      ]);

      const pendingTasks = tasks.filter(t =>
        t.status === "pending" || t.status === "in_progress"
      );

      if (messages.length === 0 && pendingTasks.length === 0) {
        await this.setIdle();
        logActivity("AGENT_IDLE", { agent: this.name });
        return { action: "idle", message: "No pending work." };
      }

      prompt = `Check your pending work and process it:\n\n`;

      if (messages.length > 0) {
        prompt += `## Messages\n${messages.map(m =>
          `- From @${m.from}: ${sanitizeInput(m.content)}`
        ).join("\n")}\n\n`;
      }

      if (pendingTasks.length > 0) {
        prompt += `## Tasks\n${pendingTasks.map(t =>
          `- [${t.priority}] ${sanitizeInput(t.title)}: ${sanitizeInput(t.description)} (Status: ${t.status})`
        ).join("\n")}`;
      }
    }

    const response = await this.chat(prompt);

    logActivity("AGENT_RUN_COMPLETE", { agent: this.name });

    return {
      action: "processed",
      message: response,
    };
  }
}
