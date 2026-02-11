import type {
  Action,
  ActionResult,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  Plugin,
  Provider,
  ProviderResult,
  State,
} from '@elizaos/core';
import { Service, logger } from '@elizaos/core';
import { z } from 'zod';

// --- Config ---

const API_URL_DEFAULT = 'https://api.ulol.li';

const configSchema = z.object({
  BASE_SIGNAL_API_KEY: z
    .string()
    .min(1, 'API key required. Get a free trial at https://ulol.li')
    .optional()
    .transform((val) => {
      if (!val) {
        logger.warn('BASE_SIGNAL_API_KEY not set — some endpoints require authentication. Get a free trial at https://ulol.li');
      }
      return val;
    }),
  BASE_SIGNAL_API_URL: z
    .string()
    .url()
    .optional()
    .default(API_URL_DEFAULT),
});

// --- Service ---

export class BaseSignalService extends Service {
  static serviceType = 'base-signals';
  capabilityDescription = 'Provides real-time smart money signals, whale tracking, and token safety scoring on Base L2.';

  public apiKey?: string;
  public apiUrl: string; // Made public for external access

  constructor(protected runtime: IAgentRuntime) {
    super(runtime);
    this.apiUrl = API_URL_DEFAULT;
  }

  static async start(runtime: IAgentRuntime) {
    logger.info('🦎 Starting Base Signal Feed service');
    const service = new BaseSignalService(runtime);
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    const service = runtime.getService(BaseSignalService.serviceType);
    if (service) service.stop();
  }

  async stop() {
    logger.info('Stopping Base Signal Feed service');
  }

  configure(apiKey?: string, apiUrl?: string) {
    this.apiKey = apiKey;
    if (apiUrl) this.apiUrl = apiUrl;
  }

  private async fetch(endpoint: string): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;
    const headers: Record<string, string> = {};
    if (this.apiKey) headers['x-api-key'] = this.apiKey;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Signal API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  async getSignals(): Promise<any> {
    return this.fetch('/signals');
  }

  async scoreToken(tokenAddress: string): Promise<any> {
    return this.fetch(`/signals/score?token=${tokenAddress}`);
  }

  async getNewPairs(): Promise<any> {
    return this.fetch('/pairs/new');
  }

  async getHealth(): Promise<any> {
    return this.fetch('/health');
  }
}

// --- Helper ---

function getService(runtime: IAgentRuntime): BaseSignalService {
  const svc = runtime.getService(BaseSignalService.serviceType) as BaseSignalService;
  if (!svc) throw new Error('Base Signal Feed service not initialized');
  return svc;
}

function formatSignals(signals: any[]): string {
  if (!signals || signals.length === 0) return 'No recent signals.';
  return signals.slice(0, 10).map((s: any, i: number) => {
    const score = s.score ?? '?';
    const symbol = s.symbol || s.token?.substring(0, 10) || '?';
    const action = s.action || 'swap';
    const wallet = s.walletLabel || s.wallet?.substring(0, 10) || '?';
    return `${i + 1}. **${symbol}** — score: ${score}, action: ${action}, wallet: ${wallet}`;
  }).join('\n');
}

// --- Actions ---

const getSignalsAction: Action = {
  name: 'GET_BASE_SIGNALS',
  similes: ['BASE_SIGNALS', 'SMART_MONEY', 'WHALE_ALERTS', 'BASE_WHALE_TRACKING'],
  description: 'Get recent smart money signals on Base L2. Shows whale wallet activity, token swaps, and signal scores.',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => true,

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const svc = getService(runtime);
      const data = await svc.getSignals();
      const signals = data.signals || data;
      const text = `🦎 **Base L2 Smart Money Signals** (last 24h)\n\n${formatSignals(signals)}\n\n_Powered by [erdGecrawl](https://ulol.li)_`;

      if (callback) {
        await callback({ text, actions: ['GET_BASE_SIGNALS'], source: message.content.source });
      }
      return { text, success: true, data: { signalCount: signals.length } };
    } catch (error) {
      logger.error({ error }, 'Error fetching Base signals');
      const errText = `Failed to fetch signals: ${error instanceof Error ? error.message : String(error)}`;
      if (callback) await callback({ text: errText, source: message.content.source });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },

  examples: [
    [
      { name: '{{userName}}', content: { text: 'What are the latest smart money signals on Base?', actions: [] } },
      { name: '{{agentName}}', content: { text: '🦎 **Base L2 Smart Money Signals** (last 24h)\n\n1. **DEGEN** — score: 78, action: BUY, wallet: whale_0x3f...', actions: ['GET_BASE_SIGNALS'] } },
    ],
    [
      { name: '{{userName}}', content: { text: 'Show me whale activity on Base chain', actions: [] } }
      ,
      { name: '{{agentName}}', content: { text: '🦎 **Base L2 Smart Money Signals** (last 24h)\n\n1. **BRETT** — score: 65, action: BUY, wallet: smart_money...', actions: ['GET_BASE_SIGNALS'] } }
    ],
  ],
};

const scoreTokenAction: Action = {
  name: 'SCORE_BASE_TOKEN',
  similes: ['CHECK_TOKEN_SAFETY', 'TOKEN_SCORE', 'IS_TOKEN_SAFE', 'BASE_TOKEN_CHECK'],
  description: 'Score a token on Base L2 for safety and signal strength. Checks honeypot risk, tax analysis, liquidity, and smart money interest.',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => true,

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      // Extract token address from message
      const text = message.content.text || '';
      const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
      if (!addrMatch) {
        const errText = 'Please provide a token address (0x...) to score.';
        if (callback) await callback({ text: errText, source: message.content.source });
        return { success: false, error: new Error('No token address found in message') };
      }

      const svc = getService(runtime);
      const data = await svc.scoreToken(addrMatch[0]);
      const score = data.score ?? data.signalScore ?? '?';
      const safety = data.safety || {};
      const symbol = data.symbol || addrMatch[0].substring(0, 10);

      const lines = [
        `🦎 **Token Score: ${symbol}**`,
        ``,
        `📊 Signal Score: **${score}/100**`,
        safety.isHoneypot !== undefined ? `🍯 Honeypot: ${safety.isHoneypot ? '⚠️ YES' : '✅ No'}` : '',
        safety.buyTax !== undefined ? `💰 Buy Tax: ${safety.buyTax}%` : '',
        safety.sellTax !== undefined ? `💰 Sell Tax: ${safety.sellTax}%` : '',
        safety.isVerified !== undefined ? `📋 Verified: ${safety.isVerified ? '✅' : '❌'}` : '',
        data.liquidity ? `💧 Liquidity: $${Number(data.liquidity).toLocaleString()}` : '',
        ``,
        `_Powered by [erdGecrawl](https://ulol.li)_`,
      ].filter(Boolean);

      const responseText = lines.join('\n');
      if (callback) {
        await callback({ text: responseText, actions: ['SCORE_BASE_TOKEN'], source: message.content.source });
      }
      return { text: responseText, success: true, data };
    } catch (error) {
      logger.error({ error }, 'Error scoring token');
      const errText = `Failed to score token: ${error instanceof Error ? error.message : String(error)}`;
      if (callback) await callback({ text: errText, source: message.content.source });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },

  examples: [
    [
      { name: '{{userName}}', content: { text: 'Is this token safe? 0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', actions: [] } },
      { name: '{{agentName}}', content: { text: '🦎 **Token Score: DEGEN**\n\n📊 Signal Score: **72/100**\n🍯 Honeypot: ✅ No\n💰 Buy Tax: 0%\n💰 Sell Tax: 0%\n📋 Verified: ✅\n💧 Liquidity: $2,450,000', actions: ['SCORE_BASE_TOKEN'] } },
    ],
  ],
};

const getNewPairsAction: Action = {
  name: 'GET_BASE_NEW_PAIRS',
  similes: ['NEW_TOKENS_BASE', 'NEW_PAIRS', 'LATEST_BASE_TOKENS', 'NEW_LISTINGS_BASE'],
  description: 'Get recently detected new token pairs on Base L2. Shows new Uniswap V3/V4 and Aerodrome listings with safety checks.',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => true,

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const svc = getService(runtime);
      const data = await svc.getNewPairs();
      const pairs = data.pairs || data;

      let text: string;
      if (!pairs || pairs.length === 0) {
        text = 'No new pairs detected recently on Base.';
      } else {
        const lines = pairs.slice(0, 10).map((p: any, i: number) => {
          const symbol = p.symbol || p.token?.substring(0, 10) || '?';
          const dex = p.dex || p.factory || '?';
          const safe = p.safe !== undefined ? (p.safe ? '✅' : '⚠️') : '?';
          return `${i + 1}. **${symbol}** on ${dex} — safety: ${safe}`;
        });
        text = `🔍 **New Pairs on Base L2**\n\n${lines.join('\n')}\n\n_Powered by [erdGecrawl](https://ulol.li)_`;
      }

      if (callback) {
        await callback({ text, actions: ['GET_BASE_NEW_PAIRS'], source: message.content.source });
      }
      return { text, success: true, data: { pairCount: pairs?.length || 0 } };
    } catch (error) {
      logger.error({ error }, 'Error fetching new pairs');
      const errText = `Failed to fetch new pairs: ${error instanceof Error ? error.message : String(error)}`;
      if (callback) await callback({ text: errText, source: message.content.source });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },

  examples: [
    [
      { name: '{{userName}}', content: { text: 'Any new tokens on Base?', actions: [] } },
      { name: '{{agentName}}', content: { text: '🔍 **New Pairs on Base L2**\n\n1. **NEWTOKEN** on Uniswap V3 — safety: ✅\n2. **MEME** on Aerodrome — safety: ⚠️', actions: ['GET_BASE_NEW_PAIRS'] } },
    ],
  ],
};

const getTrialKeyInputSchema = z.object({
  agentId: z.string().min(1, 'agentId is required').describe('ID of the AI agent requesting the trial key'),
  contact: z.string().optional().describe('Optional contact information (e.g., email, Telegram handle)'),
});

const getTrialKeyAction: Action = {
  name: 'GET_TRIAL_KEY',
  similes: ['GET_TRIAL_API_KEY', 'REQUEST_API_TRIAL', 'SIGNAL_API_TRIAL'],
  description: 'Generate a free 7-day trial API key for the Base Signal Feed. Requires an agentId. You can optionally provide contact info.',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => true,

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const svc = getService(runtime);
      // Manually extract agentId and contact from message text or agent context
      const agentIdMatch = message.content.text?.match(/agentId:\s*(\S+)/i);
      const agentId = agentIdMatch ? agentIdMatch[1] : (message.content.agent as { name?: string })?.name;

      const contactMatch = message.content.text?.match(/contact:\s*(\S+)/i);
      const contact = contactMatch ? contactMatch[1] : undefined;
      
      if (!agentId) {
        const errText = 'Please provide an agentId (e.g., "agentId: MyAgent") to generate a trial key.';
        if (callback) await callback({ text: errText, source: message.content.source });
        return { success: false, error: new Error('agentId missing for trial key generation') };
      }

      const response = await fetch(`${svc.apiUrl}/trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId, contact }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate trial key.');
      }

      const responseText = `🦎 Trial key generated for **${agentId}**:\n\n` +
                           `\`${data.apiKey}\`\n\n` +
                           `Expires: ${new Date(data.expiry).toLocaleString()}\n\n` +
                           `_Powered by [erdGecrawl](https://ulol.li)_`;

      if (callback) {
        await callback({ text: responseText, actions: ['GET_TRIAL_KEY'], source: message.content.source });
      }
      return { text: responseText, success: true, data };

    } catch (error) {
      logger.error({ error }, 'Error generating trial key');
      const errText = `Failed to generate trial key: ${error instanceof Error ? error.message : String(error)}`;
      if (callback) await callback({ text: errText, source: message.content.source });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },

  examples: [
    [
      { name: '{{userName}}', content: { text: 'Generate a trial key for MyAgent', actions: [] } },
      { name: '{{agentName}}', content: { text: '🦎 Trial key generated for **MyAgent**:\n\n`trial_xxx`\n\nExpires: ...', actions: ['GET_TRIAL_KEY'] } },
    ],
  ],
};

const getSubscriptionStatusAction: Action = {
  name: 'GET_SUBSCRIPTION_STATUS',
  similes: ['CHECK_SUBSCRIPTION', 'API_PAYMENT_STATUS', 'CHECK_PAYMENT'],
  description: 'Checks the subscription status for a given wallet address by attempting an authenticated API call.',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    // Check if payerAddress is present in the message
    return !!message.content.text?.match(/payerAddress:\s*(0x[a-fA-F0-9]{40})/i);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const svc = getService(runtime);
      const payerAddressMatch = message.content.text?.match(/payerAddress:\s*(0x[a-fA-F0-9]{40})/i);
      const payerAddress = payerAddressMatch ? payerAddressMatch[1] : undefined;

      if (!payerAddress) {
        const errText = 'Please provide a payerAddress (0x...) to check subscription status.';
        if (callback) await callback({ text: errText, source: message.content.source });
        return { success: false, error: new Error('payerAddress missing for subscription status check') };
      }

      // Attempt to fetch /health with x-payer-address header
      const url = `${svc.apiUrl}/health`;
      const headers = { 'x-payer-address': payerAddress };

      const res = await fetch(url, { headers });

      let statusText: string;
      if (res.ok) {
        statusText = `✅ Wallet **${payerAddress}** has an active subscription.`;
      } else if (res.status === 402) {
        statusText = `❌ Wallet **${payerAddress}** subscription expired or not found. Payment required.`;
      } else {
        statusText = `❓ Could not determine subscription status for **${payerAddress}**. API error: ${res.status} ${res.statusText}`;
      }

      const responseText = `🦎 Subscription Status:\n\n${statusText}\n\n_Powered by [erdGecrawl](https://ulol.li)_`;

      if (callback) {
        await callback({ text: responseText, actions: ['GET_SUBSCRIPTION_STATUS'], source: message.content.source });
      }
      return { text: responseText, success: true, data: { payerAddress, status: res.status } };

    } catch (error) {
      logger.error({ error }, 'Error checking subscription status');
      const errText = `Failed to check subscription status: ${error instanceof Error ? error.message : String(error)}`;
      if (callback) await callback({ text: errText, source: message.content.source });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },

  examples: [
    [
      { name: '{{userName}}', content: { text: 'Check subscription for payerAddress: 0xWALLET_ADDRESS', actions: [] } },
      { name: '{{agentName}}', content: { text: '🦎 Subscription Status:\n\n✅ Wallet **0xWALLET_ADDRESS** has an active subscription.', actions: ['GET_SUBSCRIPTION_STATUS'] } },
    ],
  ],
};

const guideToSubscribeAction: Action = {
  name: 'GUIDE_TO_SUBSCRIBE',
  similes: ['SUBSCRIBE_API', 'HOW_TO_PAY', 'GET_PAYMENT_INSTRUCTIONS'],
  description: 'Provides instructions and the wallet address for subscribing to the Base Signal Feed API via on-chain payment.',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => true,

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const SERVICE_WALLET_ADDRESS = '0xA28F38d6F607b35a718C3e6193E7B622246d5a2B';
      const MIN_PAYMENT_AMOUNT_ETH = 0.0001;
      const PAYMENT_VALIDITY_DAYS = 30;

      const responseText = `🦎 **Subscribe to Base Signal Feed API**\n\n` +
                           `To get full access for ${PAYMENT_VALIDITY_DAYS} days:\n` +
                           `1. Send exactly \`${MIN_PAYMENT_AMOUNT_ETH} ETH\` to the following wallet address **on the Base network**:\n` +
                           `   \`${SERVICE_WALLET_ADDRESS}\`\n` +
                           `2. Include your agent's wallet address in the \`x-payer-address\` header for all API requests.\n\n` +
                           `_No registration required. Payment verified on-chain. Powered by [erdGecrawl](https://ulol.li)_`;

      if (callback) {
        await callback({ text: responseText, actions: ['GUIDE_TO_SUBSCRIBE'], source: message.content.source });
      }
      return { text: responseText, success: true, data: { walletAddress: SERVICE_WALLET_ADDRESS, minPaymentEth: MIN_PAYMENT_AMOUNT_ETH } };

    } catch (error) {
      logger.error({ error }, 'Error providing subscription guide');
      const errText = `Failed to provide subscription guide: ${error instanceof Error ? error.message : String(error)}`;
      if (callback) await callback({ text: errText, source: message.content.source });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },

  examples: [
    [
      { name: '{{userName}}', content: { text: 'How do I subscribe to the API?', actions: [] } },
      { name: '{{agentName}}', content: { text: '🦎 **Subscribe to Base Signal Feed API**\n\n...', actions: ['GUIDE_TO_SUBSCRIBE'] } },
    ],
  ],
};

const faqQuestions = [
  {
    q: "What is the Base Signal Feed API?",
    a: "It's a real-time API for smart money signals, whale tracking, token scoring, and new pair detection on Base L2, designed for AI agents and trading bots."
  },
  {
    q: "How does smart money tracking work?",
    a: "We monitor curated whale wallets on Base, decode their swaps, and apply a multi-faceted scoring model based on wallet reputation, token safety, liquidity, and multi-wallet convergence."
  },
  {
    q: "How can I get a trial API key?",
    a: "You can generate a free 7-day trial key using the `GET_TRIAL_KEY` action, specifying your agentId."
  },
  {
    q: "How do I subscribe to the API?",
    a: "You can use the `GUIDE_TO_SUBSCRIBE` action to get instructions on how to pay 0.0001 ETH on the Base network for 30 days of access."
  },
  {
    q: "What is the token scoring based on?",
    a: "Token scoring is based on wallet reputation, token safety (honeypot, taxes, mintable), liquidity depth, and multi-wallet convergence."
  },
  {
    q: "What are the API endpoints?",
    a: "Key endpoints include `/signals` (smart money signals), `/pairs/new` (new token pairs), `/signals/score?token=` (token scoring), and `/accuracy` (signal performance stats)."
  },
  {
    q: "Where can I find the full API documentation?",
    a: "The full OpenAPI 3.0 documentation is available at https://api.ulol.li/openapi.json, and LLM-optimized docs are at https://api.ulol.li/llms.txt."
  }
];

const baseSignalFaqAction: Action = {
  name: 'BASE_SIGNAL_FAQ',
  similes: ['FAQ', 'QUESTIONS', 'ABOUT_API'],
  description: 'Provides answers to frequently asked questions about the Base Signal Feed API. You can ask a specific question or get a list of general FAQs.',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => true,

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const query = message.content.text?.toLowerCase();
      let responseText = `🦎 **Base Signal Feed API FAQ**\n\n`;
      let matchedFaq: { q: string; a: string } | undefined;

      if (query && query !== 'faq') { // 'faq' can be a trigger word
        const matchedFaq = faqQuestions.find(f => query.includes(f.q.toLowerCase()) || query.includes(f.a.toLowerCase()));
        if (matchedFaq) {
          responseText += `**Q:** ${matchedFaq.q}\n**A:** ${matchedFaq.a}`;
        } else {
          responseText += `I couldn't find a direct answer to "${query}". Here are some general FAQs:\n\n` +
                          faqQuestions.map((f, i) => `${i + 1}. **${f.q}**`).join('\n') +
                          `\n\n_Powered by [erdGecrawl](https://ulol.li)_`;
        }
      } else {
        responseText += faqQuestions.map((f, i) => `${i + 1}. **${f.q}**\n${f.a}`).join('\n\n') +
                        `\n\n_Powered by [erdGecrawl](https://ulol.li)_`;
      }

      if (callback) {
        await callback({ text: responseText, actions: ['BASE_SIGNAL_FAQ'], source: message.content.source });
      }
      return { text: responseText, success: true, data: { query, matched: !!matchedFaq } };

    } catch (error) {
      logger.error({ error }, 'Error providing FAQ');
      const errText = `Failed to provide FAQ: ${error instanceof Error ? error.message : String(error)}`;
      if (callback) await callback({ text: errText, source: message.content.source });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },

  examples: [
    [
      { name: '{{userName}}', content: { text: 'What are the FAQs for the signal API?', actions: [] } },
      { name: '{{agentName}}', content: { text: '🦎 **Base Signal Feed API FAQ**\n\n1. **What is the Base Signal Feed API?**\nIt\'s a real-time API...', actions: ['BASE_SIGNAL_FAQ'] } },
    ],
    [
      { name: '{{userName}}', content: { text: 'How do I subscribe?', actions: [] } },
      { name: '{{agentName}}', content: { text: '🦎 **Base Signal Feed API FAQ**\n\n**Q:** How do I subscribe to the API?\n**A:** You can use the `GUIDE_TO_SUBSCRIBE` action...', actions: ['BASE_SIGNAL_FAQ'] } },
    ],
  ],
};


const troubleshootApiAccessAction: Action = {
  name: 'TROUBLESHOOT_API_ACCESS',
  similes: ['API_TROUBLESHOOT', 'FIX_API_ACCESS', 'DEBUG_API'],
  description: 'Helps diagnose common issues preventing access to the Base Signal Feed API. Can check issues with API keys, payment, or endpoint connectivity.',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => true,

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const svc = getService(runtime);
      const text = message.content.text || '';

      const apiKeyMatch = text.match(/apiKey:\s*(\S+)/i);
      const inputApiKey = apiKeyMatch ? apiKeyMatch[1] : undefined;

      const payerAddressMatch = text.match(/payerAddress:\s*(0x[a-fA-F0-9]{40})/i);
      const inputPayerAddress = payerAddressMatch ? payerAddressMatch[1] : undefined;

      const endpointMatch = text.match(/endpoint:\s*(\S+)/i);
      const inputEndpoint = endpointMatch ? endpointMatch[1] : '/health'; // Default to /health

      let responseText = `🦎 **API Access Troubleshooter**\n\n`;
      let headers: Record<string, string> = {};
      let diagnosticUrl = `${svc.apiUrl}${inputEndpoint}`;

      if (inputApiKey) {
        headers['x-api-key'] = inputApiKey;
        responseText += `Attempting with trial key: \`${inputApiKey}\`\n`;
      } else if (inputPayerAddress) {
        headers['x-payer-address'] = inputPayerAddress;
        responseText += `Attempting with payer address: \`${inputPayerAddress}\`\n`;
      } else if (svc.apiKey) { // Fallback to plugin's configured API key
        headers['x-api-key'] = svc.apiKey;
        responseText += `Attempting with configured API key.\n`;
      } else {
        responseText += `No API key or payer address provided, trying unauthenticated endpoint.\n`;
        // No headers for unauthenticated calls
      }
      responseText += `Endpoint: \`${diagnosticUrl}\`\n\n`;

      let res;
      try {
        res = await fetch(diagnosticUrl, { headers });
      } catch (connError: any) {
        responseText += `❌ **Connectivity Error:** Could not reach API at \`${diagnosticUrl}\`.\n`;
        responseText += `   _Reason: ${connError.message || 'Unknown network issue'}. Check your network connection or if the API URL is correct._`;
        if (callback) await callback({ text: responseText, actions: ['TROUBLESHOOT_API_ACCESS'], source: message.content.source });
        return { success: false, error: new Error(responseText) };
      }
      
      responseText += `**API Response Status:** \`${res.status} ${res.statusText}\`\n`;

      if (res.ok) {
        responseText += `✅ **Success!** API seems accessible with the provided credentials/context.\n`;
        if (inputApiKey) {
          responseText += `   _The trial key may be valid. Check its expiry with \`GET /trial/status?key=${inputApiKey}\`._\n`;
        } else if (inputPayerAddress) {
          responseText += `   _The payment for \`${inputPayerAddress}\` is active. Check its status with \`GET_SUBSCRIPTION_STATUS\`._\n`;
        }
      } else if (res.status === 401) {
        responseText += `❌ **Authentication Error:** Invalid or missing API key/payer address.\n`;
        responseText += `   _Reason: Please ensure your API key or payer address is correct and provided in the headers._\n`;
        responseText += `   _Hint: Try \`GET_TRIAL_KEY\` for a new trial key, or \`GUIDE_TO_SUBSCRIBE\` for payment info._\n`;
      } else if (res.status === 402) {
        responseText += `❌ **Payment Required:** Your subscription for \`${inputPayerAddress || 'this wallet'}\` is expired or not found.\n`;
        responseText += `   _Reason: Send 0.0001 ETH to \`0xA28F38d6F607b35a718C3e6193E7B622246d5a2B\` on Base network for 30 days access._\n`;
        responseText += `   _Hint: Use \`GUIDE_TO_SUBSCRIBE\` action for full instructions._\n`;
      } else if (res.status === 403) {
        responseText += `❌ **Forbidden:** Access denied.\n`;
        responseText += `   _Reason: The provided API key might be expired, or the payer address is invalid._\n`;
        responseText += `   _Hint: Check \`GET_TRIAL_KEY\` or \`GET_SUBSCRIPTION_STATUS\`._\n`;
      } else if (res.status === 404) {
        responseText += `❌ **Endpoint Not Found:** The requested endpoint \`${inputEndpoint}\` does not exist.\n`;
        responseText += `   _Reason: Double-check the endpoint path. Refer to API documentation at https://api.ulol.li/openapi.json._\n`;
      } else if (res.status >= 500) {
        responseText += `❌ **Server Error:** The API encountered an internal problem.\n`;
        responseText += `   _Reason: The API server might be experiencing issues. Try again later or contact support._\n`;
      } else {
        responseText += `❓ **Unknown Error:** Unhandled API response.\n`;
        responseText += `   _Reason: Status \`${res.status} ${res.statusText}\`. Consult API documentation._\n`;
      }
      
      if (callback) {
        await callback({ text: responseText, actions: ['TROUBLESHOOT_API_ACCESS'], source: message.content.source });
      }
      return { text: responseText, success: true, data: { status: res.status, statusText: res.statusText, payerAddress: inputPayerAddress, apiKey: inputApiKey } };

    } catch (error) {
      logger.error({ error }, 'Error troubleshooting API access');
      const errText = `Failed to troubleshoot API access: ${error instanceof Error ? error.message : String(error)}`;
      if (callback) await callback({ text: errText, source: message.content.source });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },

  examples: [
    [
      { name: '{{userName}}', content: { text: 'Why is my API access not working for apiKey: trial_xyz?', actions: [] } },
      { name: '{{agentName}}', content: { text: '🦎 **API Access Troubleshooter**\n\nAttempting with trial key: `trial_xyz`...\nAPI Response Status: `403 Forbidden`\n❌ **Forbidden:** Access denied. _Reason: The provided API key might be expired._', actions: ['TROUBLESHOOT_API_ACCESS'] } },
    ],
    [
      { name: '{{userName}}', content: { text: 'Debug API access for payerAddress: 0xWALLET_ADDRESS', actions: [] } }
      ,
      { name: '{{agentName}}', content: { text: '🦎 **API Access Troubleshooter**\n\nAttempting with payer address: `0xWALLET_ADDRESS`...\nAPI Response Status: `200 OK`\n✅ **Success!** API seems accessible with the provided credentials/context.', actions: ['TROUBLESHOOT_API_ACCESS'] } }
    ],
  ],
};


// --- Provider ---

const signalSummaryProvider: Provider = {
  name: 'BASE_SIGNAL_SUMMARY',
  description: 'Provides a summary of recent smart money activity on Base L2 for agent context',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ): Promise<ProviderResult> => {
    try {
      const svc = getService(runtime);
      const health = await svc.getHealth();
      return {
        text: `Base Signal Feed is ${health.status || 'online'}. Tracking ${health.walletsTracked || '?'} whale wallets on Base L2. API: api.ulol.li`,
        values: { signalApiStatus: health.status || 'unknown' },
        data: health,
      };
    } catch {
      return {
        text: 'Base Signal Feed status unavailable.',
        values: { signalApiStatus: 'unavailable' },
        data: {},
      };
    }
  },
};

// --- Plugin Export ---

export const baseSignalsPlugin: Plugin = {
  name: 'plugin-base-signals',
  description: 'Real-time smart money signals, whale tracking, and token safety scoring on Base L2. Powered by erdGecrawl.',
  config: {
    BASE_SIGNAL_API_KEY: process.env.BASE_SIGNAL_API_KEY,
    BASE_SIGNAL_API_URL: process.env.BASE_SIGNAL_API_URL,
  },

  async init(config: Record<string, string>) {
    logger.info('🦎 Initializing Base Signal Feed plugin');
    try {
      const validated = await configSchema.parseAsync(config);
      if (validated.BASE_SIGNAL_API_KEY) process.env.BASE_SIGNAL_API_KEY = validated.BASE_SIGNAL_API_KEY;
      if (validated.BASE_SIGNAL_API_URL) process.env.BASE_SIGNAL_API_URL = validated.BASE_SIGNAL_API_URL;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const msgs = error.issues?.map((e) => e.message)?.join(', ') || 'Unknown validation error';
        throw new Error(`Base Signal Feed config error: ${msgs}`);
      }
      throw error;
    }
  },

  services: [BaseSignalService],
  actions: [getSignalsAction, scoreTokenAction, getNewPairsAction, getTrialKeyAction, getSubscriptionStatusAction, guideToSubscribeAction, baseSignalFaqAction, troubleshootApiAccessAction],
  providers: [signalSummaryProvider],
};

export default baseSignalsPlugin;
