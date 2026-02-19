# Mission Control - AI Agent Squad

An AI agent orchestration system inspired by [pbteja1998's Mission Control](https://x.com/pbteja1998/status/2017662163540971756).

## Quick Start

### 1. Install Dependencies

```bash
cd ~/mission-control
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```
OPENAI_API_KEY=sk-your-key-here
```

### 3. Set Up Convex (Optional but Recommended)

Convex provides the real-time shared database for agent coordination.

```bash
npx convex dev
```

This will:
- Create a Convex project
- Deploy the schema and functions
- Give you a deployment URL

Add the URL to your `.env`:

```
CONVEX_URL=https://your-deployment.convex.cloud
```

### 4. Run the CLI

```bash
npm run dev
```

## Usage

### Interactive CLI

The main interface for interacting with your agent squad:

```bash
npm run dev
```

Options:
- **Chat with an agent** - Direct conversation with any specialist
- **Delegate to Jarvis** - Describe what you need, Jarvis coordinates the team
- **Create a task** - Add tasks manually
- **View tasks** - See all tasks and their status
- **View activity** - Recent agent actions

### Run a Single Agent

```bash
npm run agent jarvis "Review the latest customer feedback"
npm run agent shuri "Analyze competitor X's pricing page"
```

### Run the Orchestrator

Runs all agents on a 15-minute cycle (staggered):

```bash
npm run orchestrate
```

## The Agent Squad

| Agent | Role | Specialty |
|-------|------|-----------|
| **Jarvis** | Squad Lead | Coordination, delegation, monitoring |
| **Shuri** | Product Analyst | UX review, competitive analysis, edge cases |
| **Fury** | Customer Researcher | Reviews, market research, personas |
| **Vision** | SEO Analyst | Keywords, search intent, content optimization |
| **Loki** | Content Writer | Copywriting, editing, brand voice |
| **Quill** | Social Media Manager | Threads, hooks, platform strategy |
| **Wanda** | Designer | Visual design, UI feedback |

## Architecture

```
mission-control/
├── agents/           # Agent personalities (SOUL.md files)
│   ├── jarvis/
│   ├── shuri/
│   └── ...
├── convex/           # Shared database schema & functions
├── scripts/          # CLI and orchestration
├── shared/           # AGENTS.md operating manual
├── sessions/         # Agent memory storage
└── deliverables/     # Output files
```

### Key Files

- `agents/{name}/SOUL.md` - Agent personality and role definition
- `shared/AGENTS.md` - Shared operating manual for all agents
- `convex/schema.ts` - Database schema for tasks, messages, etc.

## Customization

### Add a New Agent

1. Create `agents/{name}/SOUL.md` with the agent's personality
2. Add the agent to `scripts/agent.js` AGENTS array
3. Add scheduling in `scripts/orchestrator.js`

### Modify Agent Behavior

Edit the `SOUL.md` file for personality changes, or `shared/AGENTS.md` for operational rules that apply to all agents.

## Offline Mode

The system works without Convex - agents will run but won't share state. Good for testing individual agents.

## Tech Stack

- **Runtime**: Node.js 22+
- **Database**: Convex (real-time, serverless)
- **LLM**: OpenAI GPT-4o (configurable)
- **CLI**: Inquirer, Chalk, Ora
