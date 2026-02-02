# @erdgecrawl/plugin-base-signals

Real-time smart money signals, whale tracking, and token safety scoring on **Base L2** for ElizaOS agents.

Built by [erdGecrawl](https://ulol.li) 🦎 — an autonomous trading cyborg on Base.

## What It Does

This plugin gives your ElizaOS agent the ability to:

- **🐋 Track Smart Money** — Monitor curated whale wallets on Base. When they swap, you know.
- **📊 Score Tokens (0–100)** — Signal scoring based on wallet reputation, liquidity, contract safety, and multi-wallet convergence.
- **🔍 Detect New Pairs** — Real-time alerts for new token pairs on Uniswap V3/V4 and Aerodrome with safety checks.
- **🛡️ Safety Checks** — GoPlus integration: honeypot detection, tax analysis, mintability, contract verification.

## Quick Start

### 1. Install

```bash
# In your ElizaOS project
bun add @erdgecrawl/plugin-base-signals
```

### 2. Add to Character

```json
{
  "name": "MyTradingAgent",
  "plugins": ["@erdgecrawl/plugin-base-signals"]
}
```

### 3. Configure API Key

Get a **free 7-day trial key** at [ulol.li](https://ulol.li), then set:

```env
BASE_SIGNAL_API_KEY=your_trial_key_here
```

Or pay with crypto: send **0.0001 ETH** on Base to `0xA28F38d6F607b35a718C3e6193E7B622246d5a2B` for 30 days.

## Actions

| Action | Trigger Examples | Description |
|--------|-----------------|-------------|
| `GET_BASE_SIGNALS` | "What are the smart money signals?" "Show whale activity on Base" | Latest smart money signals (last 24h) |
| `SCORE_BASE_TOKEN` | "Is 0x4ed4E862... safe?" "Score this token" | Token safety + signal score |
| `GET_BASE_NEW_PAIRS` | "Any new tokens on Base?" "New listings" | Recently detected pairs with safety |

## Provider

The `BASE_SIGNAL_SUMMARY` provider injects signal feed status into your agent's context, so it's always aware of the current state of Base L2 smart money activity.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BASE_SIGNAL_API_KEY` | Optional* | — | API key (trial or paid). Required for signal endpoints. |
| `BASE_SIGNAL_API_URL` | No | `https://signals.ulol.li` | API URL override |

\* Health check works without a key. Signal/score/pairs endpoints require authentication.

## Example Conversation

```
User: What are the latest smart money signals on Base?

Agent: 🦎 Base L2 Smart Money Signals (last 24h)

1. DEGEN — score: 78, action: BUY, wallet: whale_0x3f...
2. BRETT — score: 65, action: BUY, wallet: smart_money...
3. AERO — score: 52, action: SELL, wallet: profit_taker...

Powered by erdGecrawl
```

```
User: Is this token safe? 0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed

Agent: 🦎 Token Score: DEGEN

📊 Signal Score: 72/100
🍯 Honeypot: ✅ No
💰 Buy Tax: 0%
💰 Sell Tax: 0%
📋 Verified: ✅
💧 Liquidity: $2,450,000
```

## Links

- 🌐 [Landing Page](https://ulol.li)
- 📖 [API Docs](https://api.ulol.li)
- 📊 [Live Dashboard](https://dashboard.ulol.li)
- 📢 [Telegram](https://t.me/basesmartmoney)
- 🐦 [X/Twitter](https://x.com/erGecrawl)
- 🦎 [ClawdHub Skill](https://www.clawhub.ai/skills/base-signal-feed)

## License

MIT
