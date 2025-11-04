
### AgentDefinition Configuration

| Field         | Type                                         | Required | Description                                                      |
| :------------ | :------------------------------------------- | :------- | :--------------------------------------------------------------- |
| `description` | `string`                                     | Yes      | Natural language description of when to use this agent           |
| `prompt`      | `string`                                     | Yes      | The agent's system prompt defining its role and behavior         |
| `tools`       | `string[]`                                   | No       | Array of allowed tool names. If omitted, inherits all tools      |
| `model`       | `'sonnet' \| 'opus' \| 'haiku' \| 'inherit'` | No       | Model override for this agent. Defaults to main model if omitted |

### Filesystem-Based Definition (Alternative)

You can also define subagents as markdown files in specific directories:

* **Project-level**: `.claude/agents/*.md` - Available only in the current project
* **User-level**: `~/.claude/agents/*.md` - Available across all projects

Each subagent is a markdown file with YAML frontmatter:

```markdown
---
name: code-reviewer
description: Expert code review specialist. Use for quality, security, and maintainability reviews.
tools: Read, Grep, Glob, Bash
---

Your subagent's system prompt goes here. This defines the subagent's
role, capabilities, and approach to solving problems.
```

**Note:** Programmatically defined agents (via the `agents` parameter) take precedence over filesystem-based agents with the same name.

## How the SDK Uses Subagents

When using the Claude Agent SDK, subagents can be defined programmatically or loaded from the filesystem. Claude will:

1. **Load programmatic agents** from the `agents` parameter in your options
2. **Auto-detect filesystem agents** from `.claude/agents/` directories (if not overridden)
3. **Invoke them automatically** based on task matching and the agent's `description`
4. **Use their specialized prompts** and tool restrictions
5. **Maintain separate context** for each subagent invocation

Programmatically defined agents (via `agents` parameter) take precedence over filesystem-based agents with the same name.

## Example Subagents

For comprehensive examples of subagents including code reviewers, test runners, debuggers, and security auditors, see the [main Subagents guide](/en/docs/claude-code/sub-agents#example-subagents). The guide includes detailed configurations and best practices for creating effective subagents.

## SDK Integration Patterns

### Automatic Invocation

The SDK will automatically invoke appropriate subagents based on the task context. Ensure your agent's `description` field clearly indicates when it should be used:

```typescript
const result = query({
  prompt: "Optimize the database queries in the API layer",
  options: {
    agents: {
      'performance-optimizer': {
        description: 'Use PROACTIVELY when code changes might impact performance. MUST BE USED for optimization tasks.',
        prompt: 'You are a performance optimization specialist...',
        tools: ['Read', 'Edit', 'Bash', 'Grep'],
        model: 'sonnet'
      }
    }
  }
});
```

### Explicit Invocation

Users can request specific subagents in their prompts:

```typescript
const result = query({
  prompt: "Use the code-reviewer agent to check the authentication module",
  options: {
    agents: {
      'code-reviewer': {
        description: 'Expert code review specialist',
        prompt: 'You are a security-focused code reviewer...',
        tools: ['Read', 'Grep', 'Glob']
      }
    }
  }
});
```

### Dynamic Agent Configuration

You can dynamically configure agents based on your application's needs:

```typescript
import { query, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

function createSecurityAgent(securityLevel: 'basic' | 'strict'): AgentDefinition {
  return {
    description: 'Security code reviewer',
    prompt: `You are a ${securityLevel === 'strict' ? 'strict' : 'balanced'} security reviewer...`,
    tools: ['Read', 'Grep', 'Glob'],
    model: securityLevel === 'strict' ? 'opus' : 'sonnet'
  };
}

const result = query({
  prompt: "Review this PR for security issues",
  options: {
    agents: {
      'security-reviewer': createSecurityAgent('strict')
    }
  }
});
```

## Tool Restrictions

Subagents can have restricted tool access via the `tools` field:

* **Omit the field** - Agent inherits all available tools (default)
* **Specify tools** - Agent can only use listed tools

Example of a read-only analysis agent:

```typescript
const result = query({
  prompt: "Analyze the architecture of this codebase",
  options: {
    agents: {
      'code-analyzer': {
        description: 'Static code analysis and architecture review',
        prompt: `You are a code architecture analyst. Analyze code structure,
identify patterns, and suggest improvements without making changes.`,
        tools: ['Read', 'Grep', 'Glob']  // No write or execute permissions
      }
    }
  }
});
```

### Common Tool Combinations

**Read-only agents** (analysis, review):

```typescript
tools: ['Read', 'Grep', 'Glob']
```

**Test execution agents**:

```typescript
tools: ['Bash', 'Read', 'Grep']
```

**Code modification agents**:

```typescript
tools: ['Read', 'Edit', 'MultiEdit', 'Write', 'Grep', 'Glob']
```

## Related Documentation

* [Main Subagents Guide](/en/docs/claude-code/sub-agents) - Comprehensive subagent documentation
* [SDK Configuration Guide](/en/api/agent-sdk/sdk-configuration-guide) - Overview of configuration approaches
* [Settings](/en/docs/claude-code/settings) - Configuration file reference
* [Slash Commands](/en/docs/claude-code/slash-commands) - Custom command creation
# Slash Commands in the SDK

> Learn how to use slash commands to control Claude Code sessions through the SDK

Slash commands provide a way to control Claude Code sessions with special commands that start with `/`. These commands can be sent through the SDK to perform actions like clearing conversation history, compacting messages, or getting help.

## Discovering Available Slash Commands

The Claude Agent SDK provides information about available slash commands in the system initialization message. Access this information when your session starts:

<CodeGroup>
  ```typescript TypeScript
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Hello Claude",
    options: { maxTurns: 1 }
  })) {
    if (message.type === "system" && message.subtype === "init") {
      console.log("Available slash commands:", message.slash_commands);
      // Example output: ["/compact", "/clear", "/help"]
    }
  }
  ```

  ```python Python
  import asyncio
  from claude_agent_sdk import query

  async def main():
      async for message in query(
          prompt="Hello Claude",
          options={"max_turns": 1}
      ):
          if message.type == "system" and message.subtype == "init":
              print("Available slash commands:", message.slash_commands)
              # Example output: ["/compact", "/clear", "/help"]

  asyncio.run(main())
  ```
</CodeGroup>

## Sending Slash Commands

Send slash commands by including them in your prompt string, just like regular text:

<CodeGroup>
  ```typescript TypeScript
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Send a slash command
  for await (const message of query({
    prompt: "/compact",
    options: { maxTurns: 1 }
  })) {
    if (message.type === "result") {
      console.log("Command executed:", message.result);
    }
  }
  ```

  ```python Python
  import asyncio
  from claude_agent_sdk import query

  async def main():
      # Send a slash command
      async for message in query(
          prompt="/compact",
          options={"max_turns": 1}
      ):
          if message.type == "result":
              print("Command executed:", message.result)

  asyncio.run(main())
  ```
</CodeGroup>

## Common Slash Commands

### `/compact` - Compact Conversation History

The `/compact` command reduces the size of your conversation history by summarizing older messages while preserving important context:

<CodeGroup>
  ```typescript TypeScript
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "/compact",
    options: { maxTurns: 1 }
  })) {
    if (message.type === "system" && message.subtype === "compact_boundary") {
      console.log("Compaction completed");
      console.log("Pre-compaction tokens:", message.compact_metadata.pre_tokens);
      console.log("Trigger:", message.compact_metadata.trigger);
    }
  }
  ```

  ```python Python
  import asyncio
  from claude_agent_sdk import query

  async def main():
      async for message in query(
          prompt="/compact",
          options={"max_turns": 1}
      ):
          if (message.type == "system" and 
              message.subtype == "compact_boundary"):
              print("Compaction completed")
              print("Pre-compaction tokens:", 
                    message.compact_metadata.pre_tokens)
              print("Trigger:", message.compact_metadata.trigger)

  asyncio.run(main())
  ```
</CodeGroup>

### `/clear` - Clear Conversation

The `/clear` command starts a fresh conversation by clearing all previous history:

<CodeGroup>
  ```typescript TypeScript
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Clear conversation and start fresh
  for await (const message of query({
    prompt: "/clear",
    options: { maxTurns: 1 }
  })) {
    if (message.type === "system" && message.subtype === "init") {
      console.log("Conversation cleared, new session started");
      console.log("Session ID:", message.session_id);
    }
  }
  ```

  ```python Python
  import asyncio
  from claude_agent_sdk import query

  async def main():
      # Clear conversation and start fresh
      async for message in query(
          prompt="/clear",
          options={"max_turns": 1}
      ):
          if message.type == "system" and message.subtype == "init":
              print("Conversation cleared, new session started")
              print("Session ID:", message.session_id)

  asyncio.run(main())
  ```
</CodeGroup>

## Creating Custom Slash Commands

In addition to using built-in slash commands, you can create your own custom commands that are available through the SDK. Custom commands are defined as markdown files in specific directories, similar to how subagents are configured.

### File Locations

Custom slash commands are stored in designated directories based on their scope:

* **Project commands**: `.claude/commands/` - Available only in the current project
* **Personal commands**: `~/.claude/commands/` - Available across all your projects

### File Format

Each custom command is a markdown file where:

* The filename (without `.md` extension) becomes the command name
* The file content defines what the command does
* Optional YAML frontmatter provides configuration

#### Basic Example

Create `.claude/commands/refactor.md`:

```markdown
Refactor the selected code to improve readability and maintainability.
Focus on clean code principles and best practices.
```

This creates the `/refactor` command that you can use through the SDK.

#### With Frontmatter

Create `.claude/commands/security-check.md`:

```markdown
---
allowed-tools: Read, Grep, Glob
description: Run security vulnerability scan
model: claude-3-5-sonnet-20241022
---

Analyze the codebase for security vulnerabilities including:
- SQL injection risks
- XSS vulnerabilities
- Exposed credentials
- Insecure configurations
```

### Using Custom Commands in the SDK

Once defined in the filesystem, custom commands are automatically available through the SDK:

<CodeGroup>
  ```typescript TypeScript
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Use a custom command
  for await (const message of query({
    prompt: "/refactor src/auth/login.ts",
    options: { maxTurns: 3 }
  })) {
    if (message.type === "assistant") {
      console.log("Refactoring suggestions:", message.message);
    }
  }

  // Custom commands appear in the slash_commands list
  for await (const message of query({
    prompt: "Hello",
    options: { maxTurns: 1 }
  })) {
    if (message.type === "system" && message.subtype === "init") {
      // Will include both built-in and custom commands
      console.log("Available commands:", message.slash_commands);
      // Example: ["/compact", "/clear", "/help", "/refactor", "/security-check"]
    }
  }
  ```

  ```python Python
  import asyncio
  from claude_agent_sdk import query

  async def main():
      # Use a custom command
      async for message in query(
          prompt="/refactor src/auth/login.py",
          options={"max_turns": 3}
      ):
          if message.type == "assistant":
              print("Refactoring suggestions:", message.message)
      
      # Custom commands appear in the slash_commands list
      async for message in query(
          prompt="Hello",
          options={"max_turns": 1}
      ):
          if message.type == "system" and message.subtype == "init":
              # Will include both built-in and custom commands
              print("Available commands:", message.slash_commands)
              # Example: ["/compact", "/clear", "/help", "/refactor", "/security-check"]

  asyncio.run(main())
  ```
</CodeGroup>

### Advanced Features

#### Arguments and Placeholders

Custom commands support dynamic arguments using placeholders:

Create `.claude/commands/fix-issue.md`:

```markdown
---
argument-hint: [issue-number] [priority]
description: Fix a GitHub issue
---

Fix issue #$1 with priority $2.
Check the issue description and implement the necessary changes.
```

Use in SDK:

<CodeGroup>
  ```typescript TypeScript
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Pass arguments to custom command
  for await (const message of query({
    prompt: "/fix-issue 123 high",
    options: { maxTurns: 5 }
  })) {
    // Command will process with $1="123" and $2="high"
    if (message.type === "result") {
      console.log("Issue fixed:", message.result);
    }
  }
  ```

  ```python Python
  import asyncio
  from claude_agent_sdk import query

  async def main():
      # Pass arguments to custom command
      async for message in query(
          prompt="/fix-issue 123 high",
          options={"max_turns": 5}
      ):
          # Command will process with $1="123" and $2="high"
          if message.type == "result":
              print("Issue fixed:", message.result)

  asyncio.run(main())
  ```
</CodeGroup>

#### Bash Command Execution

Custom commands can execute bash commands and include their output:

Create `.claude/commands/git-commit.md`:

```markdown
---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
description: Create a git commit
---

## Context

- Current status: !`git status`
- Current diff: !`git diff HEAD`

## Task

Create a git commit with appropriate message based on the changes.
```

#### File References

Include file contents using the `@` prefix:

Create `.claude/commands/review-config.md`:

```markdown
---
description: Review configuration files
---

Review the following configuration files for issues:
- Package config: @package.json
- TypeScript config: @tsconfig.json
- Environment config: @.env

Check for security issues, outdated dependencies, and misconfigurations.
```

### Organization with Namespacing

Organize commands in subdirectories for better structure:

```bash
.claude/commands/
├── frontend/
│   ├── component.md      # Creates /component (project:frontend)
│   └── style-check.md     # Creates /style-check (project:frontend)
├── backend/
│   ├── api-test.md        # Creates /api-test (project:backend)
│   └── db-migrate.md      # Creates /db-migrate (project:backend)
└── review.md              # Creates /review (project)
```

The subdirectory appears in the command description but doesn't affect the command name itself.

### Practical Examples

#### Code Review Command

Create `.claude/commands/code-review.md`:

```markdown
---
allowed-tools: Read, Grep, Glob, Bash(git diff:*)
description: Comprehensive code review
---

## Changed Files
!`git diff --name-only HEAD~1`

## Detailed Changes
!`git diff HEAD~1`

## Review Checklist

Review the above changes for:
1. Code quality and readability
2. Security vulnerabilities
3. Performance implications
4. Test coverage
5. Documentation completeness

Provide specific, actionable feedback organized by priority.
```

#### Test Runner Command

Create `.claude/commands/test.md`:

```markdown
---
allowed-tools: Bash, Read, Edit
argument-hint: [test-pattern]
description: Run tests with optional pattern
---

Run tests matching pattern: $ARGUMENTS

1. Detect the test framework (Jest, pytest, etc.)
2. Run tests with the provided pattern
3. If tests fail, analyze and fix them
4. Re-run to verify fixes
```

Use these commands through the SDK:

<CodeGroup>
  ```typescript TypeScript
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Run code review
  for await (const message of query({
    prompt: "/code-review",
    options: { maxTurns: 3 }
  })) {
    // Process review feedback
  }

  // Run specific tests
  for await (const message of query({
    prompt: "/test auth",
    options: { maxTurns: 5 }
  })) {
    // Handle test results
  }
  ```

  ```python Python
  import asyncio
  from claude_agent_sdk import query

  async def main():
      # Run code review
      async for message in query(
          prompt="/code-review",
          options={"max_turns": 3}
      ):
          # Process review feedback
          pass
      
      # Run specific tests
      async for message in query(
          prompt="/test auth",
          options={"max_turns": 5}
      ):
          # Handle test results
          pass

  asyncio.run(main())
  ```
</CodeGroup>

## See Also

* [Slash Commands](/en/docs/claude-code/slash-commands) - Complete slash command documentation
* [Subagents in the SDK](/en/api/agent-sdk/subagents) - Similar filesystem-based configuration for subagents
* [TypeScript SDK reference](/en/docs/claude-code/typescript-sdk-reference) - Complete API documentation
* [SDK overview](/en/api/agent-sdk/overview) - General SDK concepts
* [CLI reference](/en/docs/claude-code/cli-reference) - Command-line interface
# Tracking Costs and Usage

> Understand and track token usage for billing in the Claude Agent SDK

# SDK Cost Tracking

The Claude Agent SDK provides detailed token usage information for each interaction with Claude. This guide explains how to properly track costs and understand usage reporting, especially when dealing with parallel tool uses and multi-step conversations.

For complete API documentation, see the [TypeScript SDK reference](/en/docs/claude-code/typescript-sdk-reference).

## Understanding Token Usage

When Claude processes requests, it reports token usage at the message level. This usage data is essential for tracking costs and billing users appropriately.

### Key Concepts

1. **Steps**: A step is a single request/response pair between your application and Claude
2. **Messages**: Individual messages within a step (text, tool uses, tool results)
3. **Usage**: Token consumption data attached to assistant messages

## Usage Reporting Structure

### Single vs Parallel Tool Use

When Claude executes tools, the usage reporting differs based on whether tools are executed sequentially or in parallel:

<CodeGroup>
  ```typescript TypeScript
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Example: Tracking usage in a conversation
  const result = await query({
    prompt: "Analyze this codebase and run tests",
    options: {
      onMessage: (message) => {
        if (message.type === 'assistant' && message.usage) {
          console.log(`Message ID: ${message.id}`);
          console.log(`Usage:`, message.usage);
        }
      }
    }
  });
  ```

  ```python Python
  from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage
  import asyncio

  # Example: Tracking usage in a conversation
  async def track_usage():
      # Process messages as they arrive
      async for message in query(
          prompt="Analyze this codebase and run tests"
      ):
          if isinstance(message, AssistantMessage) and hasattr(message, 'usage'):
              print(f"Message ID: {message.id}")
              print(f"Usage: {message.usage}")

  asyncio.run(track_usage())
  ```
</CodeGroup>

### Message Flow Example

Here's how messages and usage are reported in a typical multi-step conversation:

```
<!-- Step 1: Initial request with parallel tool uses -->
assistant (text)      { id: "msg_1", usage: { output_tokens: 100, ... } }
assistant (tool_use)  { id: "msg_1", usage: { output_tokens: 100, ... } }
assistant (tool_use)  { id: "msg_1", usage: { output_tokens: 100, ... } }
assistant (tool_use)  { id: "msg_1", usage: { output_tokens: 100, ... } }
user (tool_result)
user (tool_result)
user (tool_result)

<!-- Step 2: Follow-up response -->
assistant (text)      { id: "msg_2", usage: { output_tokens: 98, ... } }
```

## Important Usage Rules

### 1. Same ID = Same Usage

**All messages with the same `id` field report identical usage**. When Claude sends multiple messages in the same turn (e.g., text + tool uses), they share the same message ID and usage data.

```typescript
// All these messages have the same ID and usage
const messages = [
  { type: 'assistant', id: 'msg_123', usage: { output_tokens: 100 } },
  { type: 'assistant', id: 'msg_123', usage: { output_tokens: 100 } },
  { type: 'assistant', id: 'msg_123', usage: { output_tokens: 100 } }
];

// Charge only once per unique message ID
const uniqueUsage = messages[0].usage; // Same for all messages with this ID
```

### 2. Charge Once Per Step

**You should only charge users once per step**, not for each individual message. When you see multiple assistant messages with the same ID, use the usage from any one of them.

### 3. Result Message Contains Cumulative Usage

The final `result` message contains the total cumulative usage from all steps in the conversation:

```typescript
// Final result includes total usage
const result = await query({
  prompt: "Multi-step task",
  options: { /* ... */ }
});

console.log("Total usage:", result.usage);
console.log("Total cost:", result.usage.total_cost_usd);
```

## Implementation: Cost Tracking System

Here's a complete example of implementing a cost tracking system:

<CodeGroup>
  ```typescript TypeScript
  import { query } from "@anthropic-ai/claude-agent-sdk";

  class CostTracker {
    private processedMessageIds = new Set<string>();
    private stepUsages: Array<any> = [];
    
    async trackConversation(prompt: string) {
      const result = await query({
        prompt,
        options: {
          onMessage: (message) => {
            this.processMessage(message);
          }
        }
      });
      
      return {
        result,
        stepUsages: this.stepUsages,
        totalCost: result.usage?.total_cost_usd || 0
      };
    }
    
    private processMessage(message: any) {
      // Only process assistant messages with usage
      if (message.type !== 'assistant' || !message.usage) {
        return;
      }
      
      // Skip if we've already processed this message ID
      if (this.processedMessageIds.has(message.id)) {
        return;
      }
      
      // Mark as processed and record usage
      this.processedMessageIds.add(message.id);
      this.stepUsages.push({
        messageId: message.id,
        timestamp: new Date().toISOString(),
        usage: message.usage,
        costUSD: this.calculateCost(message.usage)
      });
    }
    
    private calculateCost(usage: any): number {
      // Implement your pricing calculation here
      // This is a simplified example
      const inputCost = usage.input_tokens * 0.00003;
      const outputCost = usage.output_tokens * 0.00015;
      const cacheReadCost = (usage.cache_read_input_tokens || 0) * 0.0000075;
      
      return inputCost + outputCost + cacheReadCost;
    }
  }

  // Usage
  const tracker = new CostTracker();
  const { result, stepUsages, totalCost } = await tracker.trackConversation(
    "Analyze and refactor this code"
  );

  console.log(`Steps processed: ${stepUsages.length}`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  ```

  ```python Python
  from claude_agent_sdk import query, AssistantMessage, ResultMessage
  from datetime import datetime
  import asyncio

  class CostTracker:
      def __init__(self):
          self.processed_message_ids = set()
          self.step_usages = []

      async def track_conversation(self, prompt):
          result = None

          # Process messages as they arrive
          async for message in query(prompt=prompt):
              self.process_message(message)

              # Capture the final result message
              if isinstance(message, ResultMessage):
                  result = message

          return {
              "result": result,
              "step_usages": self.step_usages,
              "total_cost": result.total_cost_usd if result else 0
          }

      def process_message(self, message):
          # Only process assistant messages with usage
          if not isinstance(message, AssistantMessage) or not hasattr(message, 'usage'):
              return

          # Skip if already processed this message ID
          message_id = getattr(message, 'id', None)
          if not message_id or message_id in self.processed_message_ids:
              return

          # Mark as processed and record usage
          self.processed_message_ids.add(message_id)
          self.step_usages.append({
              "message_id": message_id,
              "timestamp": datetime.now().isoformat(),
              "usage": message.usage,
              "cost_usd": self.calculate_cost(message.usage)
          })

      def calculate_cost(self, usage):
          # Implement your pricing calculation
          input_cost = usage.get("input_tokens", 0) * 0.00003
          output_cost = usage.get("output_tokens", 0) * 0.00015
          cache_read_cost = usage.get("cache_read_input_tokens", 0) * 0.0000075

          return input_cost + output_cost + cache_read_cost

  # Usage
  async def main():
      tracker = CostTracker()
      result = await tracker.track_conversation("Analyze and refactor this code")

      print(f"Steps processed: {len(result['step_usages'])}")
      print(f"Total cost: ${result['total_cost']:.4f}")

  asyncio.run(main())
  ```
</CodeGroup>

## Handling Edge Cases

### Output Token Discrepancies

In rare cases, you might observe different `output_tokens` values for messages with the same ID. When this occurs:

1. **Use the highest value** - The final message in a group typically contains the accurate total
2. **Verify against total cost** - The `total_cost_usd` in the result message is authoritative
3. **Report inconsistencies** - File issues at the [Claude Code GitHub repository](https://github.com/anthropics/claude-code/issues)

### Cache Token Tracking

When using prompt caching, track these token types separately:

```typescript
interface CacheUsage {
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
}
```

## Best Practices

1. **Use Message IDs for Deduplication**: Always track processed message IDs to avoid double-charging
2. **Monitor the Result Message**: The final result contains authoritative cumulative usage
3. **Implement Logging**: Log all usage data for auditing and debugging
4. **Handle Failures Gracefully**: Track partial usage even if a conversation fails
5. **Consider Streaming**: For streaming responses, accumulate usage as messages arrive

## Usage Fields Reference

Each usage object contains:

* `input_tokens`: Base input tokens processed
* `output_tokens`: Tokens generated in the response
* `cache_creation_input_tokens`: Tokens used to create cache entries
* `cache_read_input_tokens`: Tokens read from cache
* `service_tier`: The service tier used (e.g., "standard")
* `total_cost_usd`: Total cost in USD (only in result message)

## Example: Building a Billing Dashboard

Here's how to aggregate usage data for a billing dashboard:

```typescript
class BillingAggregator {
  private userUsage = new Map<string, {
    totalTokens: number;
    totalCost: number;
    conversations: number;
  }>();
  
  async processUserRequest(userId: string, prompt: string) {
    const tracker = new CostTracker();
    const { result, stepUsages, totalCost } = await tracker.trackConversation(prompt);
    
    // Update user totals
    const current = this.userUsage.get(userId) || {
      totalTokens: 0,
      totalCost: 0,
      conversations: 0
    };
    
    const totalTokens = stepUsages.reduce((sum, step) => 
      sum + step.usage.input_tokens + step.usage.output_tokens, 0
    );
    
    this.userUsage.set(userId, {
      totalTokens: current.totalTokens + totalTokens,
      totalCost: current.totalCost + totalCost,
      conversations: current.conversations + 1
    });
    
    return result;
  }
  
  getUserBilling(userId: string) {
    return this.userUsage.get(userId) || {
      totalTokens: 0,
      totalCost: 0,
      conversations: 0
    };
  }
}
```

## Related Documentation

* [TypeScript SDK Reference](/en/docs/claude-code/typescript-sdk-reference) - Complete API documentation
* [SDK Overview](/en/api/agent-sdk/overview) - Getting started with the SDK
* [SDK Permissions](/en/api/agent-sdk/sdk-permissions) - Managing tool permissions
# Todo Lists

> Track and display todos using the Claude Agent SDK for organized task management

Todo tracking provides a structured way to manage tasks and display progress to users. The Claude Agent SDK includes built-in todo functionality that helps organize complex workflows and keep users informed about task progression.

### Todo Lifecycle

Todos follow a predictable lifecycle:

1. **Created** as `pending` when tasks are identified
2. **Activated** to `in_progress` when work begins
3. **Completed** when the task finishes successfully
4. **Removed** when all tasks in a group are completed

### When Todos Are Used

The SDK automatically creates todos for:

* **Complex multi-step tasks** requiring 3 or more distinct actions
* **User-provided task lists** when multiple items are mentioned
* **Non-trivial operations** that benefit from progress tracking
* **Explicit requests** when users ask for todo organization

## Examples

### Monitoring Todo Changes

<CodeGroup>
  ```typescript TypeScript
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Optimize my React app performance and track progress with todos",
    options: { maxTurns: 15 }
  })) {
    // Todo updates are reflected in the message stream
    if (message.type === "tool_use" && message.name === "TodoWrite") {
      const todos = message.input.todos;
      
      console.log("Todo Status Update:");
      todos.forEach((todo, index) => {
        const status = todo.status === "completed" ? "✅" : 
                      todo.status === "in_progress" ? "🔧" : "❌";
        console.log(`${index + 1}. ${status} ${todo.content}`);
      });
    }
  }
  ```

  ```python Python
  from claude_agent_sdk import query

  async for message in query(
      prompt="Optimize my React app performance and track progress with todos",
      options={"max_turns": 15}
  ):
      # Todo updates are reflected in the message stream
      if message.get("type") == "tool_use" and message.get("name") == "TodoWrite":
          todos = message["input"]["todos"]
          
          print("Todo Status Update:")
          for i, todo in enumerate(todos):
              status = "✅" if todo["status"] == "completed" else \
                      "🔧" if todo["status"] == "in_progress" else "❌"
              print(f"{i + 1}. {status} {todo['content']}")
  ```
</CodeGroup>

### Real-time Progress Display

<CodeGroup>
  ```typescript TypeScript
  import { query } from "@anthropic-ai/claude-agent-sdk";

  class TodoTracker {
    private todos: any[] = [];
    
    displayProgress() {
      if (this.todos.length === 0) return;
      
      const completed = this.todos.filter(t => t.status === "completed").length;
      const inProgress = this.todos.filter(t => t.status === "in_progress").length;
      const total = this.todos.length;
      
      console.log(`\nProgress: ${completed}/${total} completed`);
      console.log(`Currently working on: ${inProgress} task(s)\n`);
      
      this.todos.forEach((todo, index) => {
        const icon = todo.status === "completed" ? "✅" : 
                    todo.status === "in_progress" ? "🔧" : "❌";
        const text = todo.status === "in_progress" ? todo.activeForm : todo.content;
        console.log(`${index + 1}. ${icon} ${text}`);
      });
    }
    
    async trackQuery(prompt: string) {
      for await (const message of query({
        prompt,
        options: { maxTurns: 20 }
      })) {
        if (message.type === "tool_use" && message.name === "TodoWrite") {
          this.todos = message.input.todos;
          this.displayProgress();
        }
      }
    }
  }

  // Usage
  const tracker = new TodoTracker();
  await tracker.trackQuery("Build a complete authentication system with todos");
  ```

  ```python Python
  from claude_agent_sdk import query
  from typing import List, Dict

  class TodoTracker:
      def __init__(self):
          self.todos: List[Dict] = []
      
      def display_progress(self):
          if not self.todos:
              return
          
          completed = len([t for t in self.todos if t["status"] == "completed"])
          in_progress = len([t for t in self.todos if t["status"] == "in_progress"])
          total = len(self.todos)
          
          print(f"\nProgress: {completed}/{total} completed")
          print(f"Currently working on: {in_progress} task(s)\n")
          
          for i, todo in enumerate(self.todos):
              icon = "✅" if todo["status"] == "completed" else \
                    "🔧" if todo["status"] == "in_progress" else "❌"
              text = todo["activeForm"] if todo["status"] == "in_progress" else todo["content"]
              print(f"{i + 1}. {icon} {text}")
      
      async def track_query(self, prompt: str):
          async for message in query(
              prompt=prompt,
              options={"max_turns": 20}
          ):
              if message.get("type") == "tool_use" and message.get("name") == "TodoWrite":
                  self.todos = message["input"]["todos"]
                  self.display_progress()

  # Usage
  tracker = TodoTracker()
  await tracker.track_query("Build a complete authentication system with todos")
  ```
</CodeGroup>

## Related Documentation

* [TypeScript SDK Reference](/en/api/agent-sdk/typescript)
* [Python SDK Reference](/en/api/agent-sdk/python)
* [Streaming vs Single Mode](/en/api/agent-sdk/streaming-vs-single-mode)
* [Custom Tools](/en/api/agent-sdk/custom-tools)
