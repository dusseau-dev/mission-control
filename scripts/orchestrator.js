#!/usr/bin/env node

import "dotenv/config";
import { Agent, AGENTS } from "./agent.js";
import { getConvexClient } from "./convex-client.js";

// Check for OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY not set in .env file");
  console.error("Run: cp .env.example .env && edit .env to add your key");
  process.exit(1);
}

const INTERVAL = (parseInt(process.env.AGENT_INTERVAL) || 15) * 60 * 1000;

// Stagger agent wakeups
const SCHEDULE = {
  jarvis: 0,
  shuri: 0,
  fury: 5 * 60 * 1000,
  vision: 5 * 60 * 1000,
  loki: 10 * 60 * 1000,
  quill: 10 * 60 * 1000,
  wanda: 15 * 60 * 1000,
};

// Track running agents to prevent concurrent execution
const runningAgents = new Set();

async function runAgent(name, convex) {
  // Prevent concurrent execution of the same agent
  if (runningAgents.has(name)) {
    console.log(`[${new Date().toISOString()}] ${name} is still running, skipping...`);
    return;
  }

  runningAgents.add(name);
  console.log(`[${new Date().toISOString()}] Waking ${name}...`);

  try {
    const agent = new Agent(name, convex);
    const result = await agent.run();
    const summary = result.message ? result.message.slice(0, 100) : "No message";
    console.log(`[${name}] ${result.action}: ${summary}...`);
  } catch (error) {
    console.error(`[${name}] Error:`, error.message);
  } finally {
    runningAgents.delete(name);
  }
}

async function main() {
  console.log("Mission Control Orchestrator starting...");
  console.log(`Interval: ${INTERVAL / 60000} minutes`);
  console.log(`Agents: ${AGENTS.join(", ")}`);

  const convex = getConvexClient();

  if (!convex) {
    console.warn("Running in offline mode (no Convex connection)");
  }

  // Initial run with stagger
  for (const name of AGENTS) {
    const delay = SCHEDULE[name] || 0;
    setTimeout(() => runAgent(name, convex), delay);
  }

  // Schedule recurring runs
  setInterval(() => {
    for (const name of AGENTS) {
      const delay = SCHEDULE[name] || 0;
      setTimeout(() => runAgent(name, convex), delay);
    }
  }, INTERVAL);

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down orchestrator...");
    if (runningAgents.size > 0) {
      console.log(`Waiting for ${runningAgents.size} agent(s) to finish: ${[...runningAgents].join(", ")}`);
    }
    // Give running agents a moment to finish, then exit
    setTimeout(() => process.exit(0), 2000);
  });

  // Keep process running
  console.log("Orchestrator running. Press Ctrl+C to stop.");
}

main();
