---
name: elizaos-base-signal-feed
version: 0.1.0
description: Integrates the Base Signal Feed API as an ElizaOS plugin for Claude Code.
metadata:
  {
    "openclaw":
      {
        "emoji": "🦎",
        "category": "trading",
      },
  }
---

# ElizaOS Base Signal Feed Skill (for Claude Code)

This skill provides the Base Signal Feed API's functionalities as an ElizaOS plugin, enabling Claude Code to access real-time smart money signals on Base L2. The plugin is built following the ElizaOS plugin architecture, making it compatible with Claude Code's automated review and integration workflows.

## Functions Provided (ElizaOS Actions)

The plugin exposes the following actions for other ElizaOS agents, which Claude Code can interpret and utilize:

-   `GET_SIGNALS`: Retrieves the latest smart money signals.
    -   **Description:** Fetches a list of recent smart money activities, including whale movements, token scores, and new pair detections.
    -   **Parameters:** None.
    -   **Example Use (Conceptual):**
        \`\`\`
        Agent: "Get the latest smart money signals from the Base Feed."
        Claude Code: Calls `GET_SIGNALS` action.
        \`\`\`
-   `GET_TOKEN_SCORE(token_address: string)`: Retrieves the smart money score for a given token.
    -   **Description:** Provides a proprietary score (0-100) for a specified token address, indicating its smart money interest and potential.
    -   **Parameters:**
        -   `token_address` (string, required): The contract address of the token on Base L2 (e.g., "0x...").
    -   **Example Use (Conceptual):**
        \`\`\`
        Agent: "What's the smart money score for token 0x123...abc?"
        Claude Code: Calls `GET_TOKEN_SCORE` action with `token_address="0x123...abc"`.
        \`\`\`
-   `GET_NEW_PAIRS()`: Lists recently detected new trading pairs.
    -   **Description:** Identifies newly created liquidity pools on Base L2, often accompanied by initial safety checks.
    -   **Parameters:** None.
    -   **Example Use (Conceptual):**
        \`\`\`
        Agent: "Show me the newest trading pairs on Base."
        Claude Code: Calls `GET_NEW_PAIRS` action.
        \`\`\`
-   `CHECK_HEALTH()`: Checks the health status of the Base Signal Feed API.
    -   **Description:** Verifies the operational status of the underlying Base Signal Feed API.
    -   **Parameters:** None.
    -   **Example Use (Conceptual):**
        \`\`\`
        Agent: "Is the Base Signal Feed API up and running?"
        Claude Code: Calls `CHECK_HEALTH` action.
        \`\`\`

## ElizaOS Specific Actions (Customer Skills)

In addition to the core signal functionalities, this plugin also includes customer-centric ElizaOS actions:

-   `GET_TRIAL_KEY`: Automatically generate a 7-day trial API key.
-   `GET_SUBSCRIPTION_STATUS(wallet_address: string)`: Check subscription status for a given wallet.
-   `GUIDE_TO_SUBSCRIBE`: Provides instructions for on-chain payment subscription.
-   `BASE_SIGNAL_FAQ`: Answers frequently asked questions about the API.
-   `TROUBLESHOOT_API_ACCESS`: Helps diagnose API access issues.

## Integration with Claude Code

The plugin is designed to be published to the ElizaOS plugin registry, where Claude Code's automated workflow will review and make it available. Once integrated into an ElizaOS agent, Claude Code will be able to discover and utilize these actions based on natural language prompts.

## Configuration

The plugin requires the following configuration parameters, typically set as environment variables or within the ElizaOS agent's configuration:

-   `BASE_SIGNAL_API_KEY`: API key for accessing the Base Signal Feed.
-   `BASE_SIGNAL_API_URL`: URL of the Base Signal Feed API (default: `https://signals.ulol.li`).

## Source Code & Further Information

The source code for this ElizaOS plugin is located in this directory. Further details on the ElizaOS plugin architecture can be found in the official ElizaOS documentation.
