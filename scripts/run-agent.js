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

const args = process.argv.slice(2);
const agentName = args[0];
const task = args.slice(1).join(" ") || null;

if (!agentName || !AGENTS.includes(agentName)) {
  console.error(`Usage: node run-agent.js <agent-name> [task]`);
  console.error(`Available agents: ${AGENTS.join(", ")}`);
  process.exit(1);
}

async function main() {
  console.log(`Starting agent: ${agentName}`);

  const convex = getConvexClient();

  try {
    const agent = new Agent(agentName, convex);
    const result = await agent.run(task);
    console.log(`\n[${agentName}] ${result.action}`);
    console.log(result.message);
  } catch (error) {
    console.error(`Agent error:`, error.message);
    process.exit(1);
  }
}

main();
