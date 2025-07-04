# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
ALWAYS use ONLY Environments for ANY and ALL file, code, or shell operations—NO EXCEPTIONS—even for simple or generic requests.

DO NOT install or use the git cli with the environment_run_cmd tool. All environment tools will handle git operations for you. Changing ".git" yourself will compromise the integrity of your environment.

You MUST inform the user how to view your work using cu log <env_id> AND cu checkout <env_id>. Failure to do this will make your work inaccessible to others.
## Development Commands

- `bun run dev` - Start the development server (Next.js on port 3000)
- `bun run build` - Build the production application
- `bun run start` - Start the production server
- `bun run lint` - Run ESLint to check code quality

## Environment Setup

The application requires `OPENAI_API_KEY` environment variable. Add it to `.env.local` or your shell profile.

## Architecture Overview

This is a Next.js TypeScript application demonstrating advanced OpenAI Realtime API patterns with the OpenAI Agents SDK. The core architecture implements two main agentic patterns:

### 1. Chat-Supervisor Pattern
- **Chat Agent** (gpt-4o-realtime-mini): Handles immediate responses and basic tasks
- **Supervisor Agent** (gpt-4.1): Processes complex queries and tool calls
- Flow: User → Chat Agent → [Supervisor if needed] → Response
- Implementation: `src/app/agentConfigs/chatSupervisor/`

### 2. Sequential Handoff Pattern
- Multiple specialized agents handle different user intents
- Agents transfer users between each other via tool calls
- Implementation: `src/app/agentConfigs/customerServiceRetail/` and `src/app/agentConfigs/simpleHandoff.ts`

## Key Directory Structure

```
src/app/
├── agentConfigs/           # Agent definitions and scenarios
│   ├── index.ts           # Central registry of all agent scenarios
│   ├── types.ts           # Type definitions for agents
│   ├── chatSupervisor/    # Chat-supervisor pattern implementation
│   ├── customerServiceRetail/ # Complex multi-agent flow
│   └── simpleHandoff.ts   # Basic handoff example
├── api/
│   ├── session/route.ts   # OpenAI Realtime API session management
│   └── responses/route.ts # Response handling and guardrails
├── components/            # React UI components
├── contexts/             # React context providers
├── hooks/               # Custom React hooks
└── lib/                # Utility functions
```

## Agent Configuration System

### Creating New Agent Scenarios
1. Create new agent configuration in `src/app/agentConfigs/`
2. Add to `src/app/agentConfigs/index.ts` registry
3. Agent configs export arrays of `RealtimeAgent` objects

### Agent Configuration Structure
```typescript
interface AgentConfig {
  name: string;
  publicDescription: string; // For agent transfer tools
  instructions: string;
  tools: Tool[];
  toolLogic?: Record<string, Function>; // Tool implementation
  downstreamAgents?: AgentConfig[]; // Handoff targets
}
```

## Core Technical Components

### OpenAI Agents SDK Integration
- Uses `@openai/agents/realtime` for agent management
- `RealtimeSession` handles WebRTC connections
- `RealtimeAgent` defines agent behavior and capabilities

### Session Management
- Ephemeral session tokens from `/api/session`
- WebRTC connection via `OpenAIRealtimeWebRTC`
- Session state managed in `useRealtimeSession` hook

### Tool System
- Tools defined with JSON schema parameters
- `toolLogic` maps tool names to implementation functions
- Tool calls handled through agent event system

### Guardrails System
- Output moderation via `/api/responses`
- Categories: OFFENSIVE, OFF_BRAND, VIOLENCE, NONE
- Real-time content filtering during response generation

## Development Patterns

### Adding New Tools
1. Define tool schema in agent configuration
2. Implement logic in `toolLogic` object
3. Return structured data for conversation context

### Agent Handoffs
- Use `agent_transfer` tool to switch between agents
- Target agent must be in `downstreamAgents` array
- Handoff triggers session update with new instructions

### Testing Agent Flows
- Use dropdown menus to switch scenarios and agents
- Monitor transcript (left panel) and event logs (right panel)
- Test different user intents and edge cases

## Model Configuration

- Default realtime model: `gpt-4o-realtime-preview-2025-06-03`
- Supervisor models: `gpt-4.1` or `gpt-4o-mini` for cost optimization
- Model selection affects latency, cost, and capability trade-offs

## Session Context Management

The application maintains conversation state through:
- Transcript items with message history
- Event logging for debugging
- Agent-specific context preservation during handoffs
- Tool call results integrated into conversation flow