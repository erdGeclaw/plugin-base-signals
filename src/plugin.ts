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

const API_URL_DEFAULT = 'https://signals.ulol.li';

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

  private apiKey?: string;
  private apiUrl: string;

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
      { name: '{{userName}}', content: { text: 'Show me whale activity on Base chain', actions: [] } },
      { name: '{{agentName}}', content: { text: '🦎 **Base L2 Smart Money Signals** (last 24h)\n\n1. **BRETT** — score: 65, action: BUY, wallet: smart_money...', actions: ['GET_BASE_SIGNALS'] } },
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
        text: `Base Signal Feed is ${health.status || 'online'}. Tracking ${health.walletsTracked || '?'} whale wallets on Base L2. API: signals.ulol.li`,
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
  actions: [getSignalsAction, scoreTokenAction, getNewPairsAction],
  providers: [signalSummaryProvider],
};

export default baseSignalsPlugin;
