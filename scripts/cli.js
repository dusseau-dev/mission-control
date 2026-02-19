#!/usr/bin/env node

import "dotenv/config";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { Agent, AGENTS } from "./agent.js";
import { getConvexClient } from "./convex-client.js";
import {
  sanitizeInput,
  containsSecrets,
  redactSecrets,
  initializeLogging,
  logActivity,
  logSecurityEvent,
} from "./security.js";

// Initialize logging for the session
initializeLogging();

const convex = getConvexClient();

function printHeader() {
  console.clear();
  console.log(chalk.cyan.bold(`
  ╔══════════════════════════════════════╗
  ║        MISSION CONTROL               ║
  ║     AI Agent Squad Interface         ║
  ╚══════════════════════════════════════╝
  `));
}

function printAgentStatus() {
  console.log(chalk.yellow("\nAgent Squad:"));
  console.log(chalk.white("  Jarvis   - Squad Lead"));
  console.log(chalk.white("  Shuri    - Product Analyst"));
  console.log(chalk.white("  Fury     - Customer Researcher"));
  console.log(chalk.white("  Vision   - SEO Analyst"));
  console.log(chalk.white("  Loki     - Content Writer"));
  console.log(chalk.white("  Quill    - Social Media Manager"));
  console.log(chalk.white("  Wanda    - Designer"));
  console.log();
}

function printSecurityNotice() {
  console.log(chalk.gray("Security: Logs stored in ./logs/ | Secrets auto-redacted\n"));
}

function truncate(str, maxLen) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}

/**
 * Check user input for secrets and warn
 */
function checkAndWarnSecrets(input, context) {
  if (containsSecrets(input)) {
    logSecurityEvent("SECRETS_DETECTED_IN_INPUT", { context });
    console.log(chalk.red("\n⚠️  WARNING: Your input appears to contain secrets (API keys, passwords, etc.)"));
    console.log(chalk.yellow("   These will be redacted for safety. Please avoid entering secrets.\n"));
    return true;
  }
  return false;
}

async function chatWithAgent(agentName) {
  logActivity("CHAT_SESSION_START", { agent: agentName });

  const agent = new Agent(agentName, convex);

  console.log(chalk.green(`\nConnected to ${chalk.bold(agentName)}. Type 'exit' to return.\n`));
  console.log(chalk.gray("Tip: Don't enter passwords or API keys - they'll be redacted.\n"));

  while (true) {
    const { message } = await inquirer.prompt([
      {
        type: "input",
        name: "message",
        message: chalk.cyan(`You → ${agentName}:`),
      },
    ]);

    if (message.toLowerCase() === "exit") {
      console.log(chalk.yellow(`\nDisconnected from ${agentName}.\n`));
      logActivity("CHAT_SESSION_END", { agent: agentName });
      break;
    }

    if (!message.trim()) continue;

    // Check for secrets in user input
    checkAndWarnSecrets(message, "chat_message");

    const spinner = ora(`${agentName} is thinking...`).start();

    try {
      const response = await agent.chat(message);
      spinner.stop();
      // Redact any secrets in response before display
      console.log(chalk.green(`\n${agentName}:`), redactSecrets(response), "\n");
    } catch (error) {
      spinner.stop();
      // Don't expose internal errors
      console.log(chalk.red(`Error: ${redactSecrets(error.message)}\n`));
    }
  }
}

async function createTask() {
  logActivity("CREATE_TASK_START");

  const { title, description, priority, assignedTo } = await inquirer.prompt([
    {
      type: "input",
      name: "title",
      message: "Task title:",
      validate: (input) => {
        if (!input.trim()) return "Title required";
        if (containsSecrets(input)) {
          return "Title appears to contain secrets. Please remove them.";
        }
        return true;
      },
    },
    {
      type: "input",
      name: "description",
      message: "Task description:",
      validate: (input) => {
        if (!input.trim()) return "Description required";
        if (containsSecrets(input)) {
          return "Description appears to contain secrets. Please remove them.";
        }
        return true;
      },
    },
    {
      type: "list",
      name: "priority",
      message: "Priority:",
      choices: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    {
      type: "list",
      name: "assignedTo",
      message: "Assign to:",
      choices: ["(unassigned)", ...AGENTS],
    },
  ]);

  // Sanitize inputs
  const safeTitle = sanitizeInput(title);
  const safeDescription = sanitizeInput(description);

  if (!convex) {
    console.log(chalk.yellow("\nTask created (offline mode - data NOT persisted)"));
    console.log(chalk.white(`  Title: ${safeTitle}`));
    console.log(chalk.white(`  Priority: ${priority}`));
    console.log(chalk.white(`  Assigned: ${assignedTo === "(unassigned)" ? "None" : assignedTo}`));
    return;
  }

  const spinner = ora("Creating task...").start();

  try {
    await convex.mutation("tasks/create", {
      title: safeTitle,
      description: safeDescription,
      priority,
      assignedTo: assignedTo === "(unassigned)" ? undefined : assignedTo,
      createdBy: "user",
      tags: [],
    });
    spinner.succeed("Task created!");
    logActivity("CREATE_TASK_SUCCESS", { title: safeTitle });
  } catch (error) {
    spinner.fail(`Error: ${redactSecrets(error.message)}`);
    logActivity("CREATE_TASK_FAILED", { error: redactSecrets(error.message) });
  }
}

async function viewTasks() {
  if (!convex) {
    console.log(chalk.yellow("\nNo Convex connection. Cannot fetch tasks."));
    console.log(chalk.gray("Set CONVEX_URL in .env to enable task persistence.\n"));
    return;
  }

  const spinner = ora("Fetching tasks...").start();

  try {
    const tasks = await convex.query("tasks/list", {});
    spinner.stop();

    if (tasks.length === 0) {
      console.log(chalk.yellow("\nNo tasks found.\n"));
      return;
    }

    console.log(chalk.cyan("\n═══ Tasks ═══\n"));

    for (const task of tasks) {
      const priorityColors = {
        urgent: chalk.red,
        high: chalk.yellow,
        medium: chalk.white,
        low: chalk.gray,
      };
      const statusColors = {
        pending: chalk.gray,
        in_progress: chalk.yellow,
        review: chalk.cyan,
        completed: chalk.green,
        blocked: chalk.red,
      };

      const priority = priorityColors[task.priority](`[${task.priority}]`);
      const status = statusColors[task.status](`(${task.status})`);
      const assignee = task.assignedTo ? chalk.blue(`@${task.assignedTo}`) : chalk.gray("unassigned");

      // Redact any secrets that might be in task content
      console.log(`${priority} ${chalk.bold(redactSecrets(task.title))} ${status}`);
      console.log(`   ${chalk.gray(truncate(redactSecrets(task.description), 60))}`);
      console.log(`   Assigned: ${assignee}  Created by: ${task.createdBy}`);
      console.log();
    }

    logActivity("VIEW_TASKS", { count: tasks.length });
  } catch (error) {
    spinner.fail(`Error: ${redactSecrets(error.message)}`);
  }
}

async function viewActivity() {
  if (!convex) {
    console.log(chalk.yellow("\nNo Convex connection. Cannot fetch activity."));
    console.log(chalk.gray("Set CONVEX_URL in .env to enable activity tracking.\n"));
    return;
  }

  const spinner = ora("Fetching activity...").start();

  try {
    const activities = await convex.query("activities/list", { limit: 20 });
    spinner.stop();

    if (activities.length === 0) {
      console.log(chalk.yellow("\nNo activity found.\n"));
      return;
    }

    console.log(chalk.cyan("\n═══ Recent Activity ═══\n"));

    for (const activity of activities) {
      const time = new Date(activity.createdAt).toISOString().replace("T", " ").slice(0, 19);
      console.log(`${chalk.gray(time)} ${chalk.blue(`@${activity.agentName}`)} ${activity.action}`);
      // Redact any secrets in activity details
      console.log(`   ${chalk.white(truncate(redactSecrets(activity.details), 80))}`);
      console.log();
    }

    logActivity("VIEW_ACTIVITY", { count: activities.length });
  } catch (error) {
    spinner.fail(`Error: ${redactSecrets(error.message)}`);
  }
}

async function viewSecurityLogs() {
  console.log(chalk.cyan("\n═══ Security Information ═══\n"));
  console.log(chalk.white("Session logs are stored in: ./logs/"));
  console.log(chalk.white("All secrets are automatically redacted from logs."));
  console.log(chalk.white("\nTo view recent logs:"));
  console.log(chalk.gray("  ls -la logs/"));
  console.log(chalk.gray("  tail -f logs/session-*.log"));
  console.log();
}

async function delegateToJarvis() {
  logActivity("DELEGATE_START");

  const { task } = await inquirer.prompt([
    {
      type: "input",
      name: "task",
      message: "What would you like the squad to do?",
      validate: (input) => {
        if (!input.trim()) return "Please describe the task";
        if (containsSecrets(input)) {
          return "Your request appears to contain secrets. Please remove them.";
        }
        return true;
      },
    },
  ]);

  // Sanitize input
  const safeTask = sanitizeInput(task);

  const agent = new Agent("jarvis", convex);
  const spinner = ora("Jarvis is processing your request...").start();

  try {
    const response = await agent.chat(
      `New request from user: ${safeTask}\n\nAnalyze this request and either handle it yourself or delegate to the appropriate specialist. Create tasks as needed.`
    );
    spinner.stop();
    console.log(chalk.green(`\nJarvis:`), redactSecrets(response), "\n");
    logActivity("DELEGATE_SUCCESS");
  } catch (error) {
    spinner.fail(`Error: ${redactSecrets(error.message)}`);
    logActivity("DELEGATE_FAILED", { error: redactSecrets(error.message) });
  }
}

async function mainMenu() {
  printHeader();
  printAgentStatus();
  printSecurityNotice();

  logActivity("CLI_SESSION_START");

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        choices: [
          { name: "Chat with an agent", value: "chat" },
          { name: "Delegate to Jarvis (squad lead)", value: "delegate" },
          { name: "Create a task", value: "create_task" },
          { name: "View all tasks", value: "view_tasks" },
          { name: "View activity feed", value: "view_activity" },
          new inquirer.Separator(),
          { name: "Security info", value: "security" },
          { name: "Exit", value: "exit" },
        ],
      },
    ]);

    switch (action) {
      case "chat":
        const { agent } = await inquirer.prompt([
          {
            type: "list",
            name: "agent",
            message: "Which agent?",
            choices: AGENTS.map((name) => ({
              name: `${name.charAt(0).toUpperCase() + name.slice(1)}`,
              value: name,
            })),
          },
        ]);
        await chatWithAgent(agent);
        break;

      case "delegate":
        await delegateToJarvis();
        break;

      case "create_task":
        await createTask();
        break;

      case "view_tasks":
        await viewTasks();
        break;

      case "view_activity":
        await viewActivity();
        break;

      case "security":
        await viewSecurityLogs();
        break;

      case "exit":
        logActivity("CLI_SESSION_END");
        console.log(chalk.cyan("\nMission Control signing off.\n"));
        process.exit(0);
    }
  }
}

// Check for OpenAI API key (don't log the actual key!)
if (!process.env.OPENAI_API_KEY) {
  console.log(chalk.red("\nError: OPENAI_API_KEY not set in .env file"));
  console.log(chalk.yellow("Run: cp .env.example .env && edit .env to add your key\n"));
  process.exit(1);
}

// Validate API key format without exposing it
if (!process.env.OPENAI_API_KEY.startsWith("sk-")) {
  console.log(chalk.yellow("\nWarning: OPENAI_API_KEY doesn't look like a valid OpenAI key"));
  console.log(chalk.gray("Valid keys typically start with 'sk-'\n"));
}

mainMenu().catch((error) => {
  // Don't expose secrets in error output
  console.error(redactSecrets(error.message));
  process.exit(1);
});
