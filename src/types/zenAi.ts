import { UrgencyLevel } from './dispatch';

export type AiProviderId =
  | 'auto'          // ZEN AI Auto (Tries best configured provider, seamlessly falls back)
  | 'gemini'        // Google Gemini (gemini-2.5-flash, gemini-1.5-flash)
  | 'openai'        // OpenAI (gpt-4o, gpt-4o-mini, o3-mini)
  | 'anthropic'     // Anthropic Claude (claude-3-5-sonnet, claude-3-5-haiku)
  | 'groq'          // Groq Ultra-Fast (llama-3.3-70b-versatile, llama-3.1-8b)
  | 'mistral'       // Mistral AI (mistral-large, codestral)
  | 'openrouter'    // OpenRouter / DeepSeek / Custom endpoint
  | 'local';        // ZEN Autonomous Local Engine (Traditional route & heuristics - always works!)

export interface AiProviderConfig {
  id: AiProviderId;
  name: string;
  badge: string;
  description: string;
  defaultModel: string;
  availableModels: string[];
  requiresKey: boolean;
  keyPlaceholder: string;
  docsUrl: string;
  speed: 'Ultra-Fast' | 'Fast' | 'Balanced' | 'Instant';
}

export interface UserAiKeys {
  gemini?: string;
  openai?: string;
  anthropic?: string;
  groq?: string;
  mistral?: string;
  openrouter?: string;
  customBaseUrl?: string;
}

export interface ServerAiConfigStatus {
  hasGeminiKey: boolean;
  hasOpenaiKey: boolean;
  hasAnthropicKey: boolean;
  hasGroqKey: boolean;
  hasMistralKey: boolean;
  hasOpenrouterKey: boolean;
  activeDefaultProvider: AiProviderId;
}

export interface AiAddressIntel {
  address: string;
  metroZone: string;            // e.g. "North Dallas / Plano Corridor", "Fort Worth Logistics District"
  crossStreets?: string;         // e.g. "Preston Rd & Campbell Rd"
  primaryCorridor: string;       // e.g. "US-75 Northbound", "I-35E Stemmons Freeway"
  accessRecommendations: string[]; // e.g. "Rooftop equipment requires North alley parking"
  trafficRiskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  estimatedCrossTownMinutes: number;
  providerUsed: string;
}

export interface ZenDispatchAnalysis {
  summary: string;
  fleetHealth: string;
  estimatedFuelSavingsGallons: number;
  estimatedDriveTimeSavedMinutes: number;
  recommendations: Array<{
    ticketId: string;
    ticketNumber: string;
    recommendedTechId: string;
    recommendedTechName: string;
    urgency: UrgencyLevel;
    rationale: string;
    estimatedDriveMins: number;
    urgencyLevelScore: number;
    corridorAdvantage?: string;
  }>;
  strategicInsights: string[];
  engineUsed: string;         // e.g. "ZEN AI (OpenAI GPT-4o)", "ZEN Autonomous Local Engine"
  provider: AiProviderId;
  responseTimeMs?: number;
}
