import React, { useState, useEffect } from 'react';
import { 
  AiProviderId, 
  AiProviderConfig 
} from '../types/zenAi';
import { 
  AI_PROVIDERS, 
  zenAi 
} from '../services/aiProviderService';
import { ZenLogo } from './brand/ZenLogo';
import { 
  Check, 
  X, 
  Key, 
  Zap, 
  ShieldCheck, 
  AlertCircle, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  RefreshCw,
  Cpu,
  Layers,
  Sparkles,
  Server
} from 'lucide-react';

interface ZenAiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProviderChanged?: (providerId: AiProviderId) => void;
}

export const ZenAiSettingsModal: React.FC<ZenAiSettingsModalProps> = ({
  isOpen,
  onClose,
  onProviderChanged,
}) => {
  const [activeProvider, setActiveProvider] = useState<AiProviderId>(zenAi.getActiveProvider());
  const [userKeys, setUserKeys] = useState(zenAi.getUserKeys());
  const [serverStatus, setServerStatus] = useState(zenAi.getServerStatus());
  const [visibleKey, setVisibleKey] = useState<Record<string, boolean>>({});
  const [testingProvider, setTestingProvider] = useState<AiProviderId | null>(null);
  const [testResult, setTestResult] = useState<{ provider: AiProviderId; success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveProvider(zenAi.getActiveProvider());
      setUserKeys(zenAi.getUserKeys());
      zenAi.refreshServerConfig().then(setServerStatus);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectProvider = (id: AiProviderId) => {
    setActiveProvider(id);
    zenAi.setActiveProvider(id);
    if (onProviderChanged) {
      onProviderChanged(id);
    }
  };

  const handleKeyChange = (provider: keyof typeof userKeys, value: string) => {
    setUserKeys((prev) => ({ ...prev, [provider]: value }));
    zenAi.setUserKey(provider, value);
  };

  const handleTestConnection = async (provider: AiProviderId) => {
    setTestingProvider(provider);
    setTestResult(null);

    const result = await zenAi.testProviderConnection(provider);
    setTestingProvider(null);
    setTestResult({
      provider,
      success: result.success,
      message: result.message,
    });
  };

  const toggleVisibility = (provider: string) => {
    setVisibleKey((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const providerList = Object.values(AI_PROVIDERS);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="zen-ai-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <ZenLogo size={36} variant="badge" />
            <div>
              <div className="flex items-center gap-2">
                <h2 id="zen-ai-settings-title" className="text-base font-extrabold tracking-tight">
                  ZEN AI Co. Engine Configuration
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-400/30">
                  Multi-Provider
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Configure OpenAI, Google Gemini, Anthropic Claude, Groq, Mistral, or the guaranteed Autonomous Engine.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
          {/* Active Provider Indicator Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md flex-shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                  Active Dispatch Engine
                </div>
                <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span>{AI_PROVIDERS[activeProvider].name}</span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold">
                    {AI_PROVIDERS[activeProvider].speed}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-1 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Always Active
              </span>
            </div>
          </div>

          {/* Test Result Feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between animate-fadeIn ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                )}
                <span>
                  <strong>{AI_PROVIDERS[testResult.provider].name}:</strong> {testResult.message}
                </span>
              </div>
              <button
                onClick={() => setTestResult(null)}
                className="text-slate-400 hover:text-slate-700 ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Provider Selection & Key Configuration Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Select & Configure AI Intelligence Providers
            </h3>

            {providerList.map((prov) => {
              const isSelected = activeProvider === prov.id;
              const hasServerKey = 
                (prov.id === 'gemini' && serverStatus.hasGeminiKey) ||
                (prov.id === 'openai' && serverStatus.hasOpenaiKey) ||
                (prov.id === 'anthropic' && serverStatus.hasAnthropicKey) ||
                (prov.id === 'groq' && serverStatus.hasGroqKey) ||
                (prov.id === 'mistral' && serverStatus.hasMistralKey) ||
                (prov.id === 'openrouter' && serverStatus.hasOpenrouterKey);

              const userVal = userKeys[prov.id as keyof typeof userKeys] || '';
              const isReady = zenAi.isProviderReady(prov.id);

              return (
                <div
                  key={prov.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="zen-ai-provider"
                        id={`provider-${prov.id}`}
                        checked={isSelected}
                        onChange={() => handleSelectProvider(prov.id)}
                        className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <label
                          htmlFor={`provider-${prov.id}`}
                          className="font-bold text-sm text-slate-900 cursor-pointer flex items-center gap-2"
                        >
                          <span>{prov.name}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {prov.badge}
                          </span>
                        </label>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                          {prov.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isReady ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          Ready
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                          Needs Key
                        </span>
                      )}
                    </div>
                  </div>

                  {/* API Key Input Row (if provider requires key) */}
                  {prov.requiresKey && (
                    <div className="mt-3 pt-3 border-t border-slate-100 pl-7 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-semibold flex items-center gap-1">
                          <Key className="w-3 h-3 text-slate-400" />
                          <span>Custom API Key {hasServerKey ? '(Server Key Active)' : ''}</span>
                        </span>
                        <a
                          href={prov.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5"
                        >
                          <span>Get Key</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type={visibleKey[prov.id] ? 'text' : 'password'}
                            value={userVal}
                            onChange={(e) => handleKeyChange(prov.id as any, e.target.value)}
                            placeholder={hasServerKey ? 'Using server environment key (or enter custom key)' : prov.keyPlaceholder}
                            className="w-full text-xs font-mono px-3 py-2 pr-8 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => toggleVisibility(prov.id)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            title={visibleKey[prov.id] ? 'Hide Key' : 'Show Key'}
                          >
                            {visibleKey[prov.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTestConnection(prov.id)}
                          disabled={testingProvider === prov.id || (!userVal && !hasServerKey)}
                          className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                          title="Test connection to provider"
                        >
                          {testingProvider === prov.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span>Test</span>
                        </button>
                      </div>

                      {/* Custom Base URL for OpenRouter / DeepSeek */}
                      {prov.id === 'openrouter' && (
                        <div className="pt-1">
                          <input
                            type="text"
                            value={userKeys.customBaseUrl || ''}
                            onChange={(e) => handleKeyChange('customBaseUrl', e.target.value)}
                            placeholder="Custom Base URL (optional, e.g. https://api.deepseek.com/v1)"
                            className="w-full text-[11px] font-mono px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Guaranteed Fallback Notice for Local Engine */}
                  {prov.id === 'local' && (
                    <div className="mt-2.5 pl-7 text-[11px] text-emerald-800 bg-emerald-50/60 p-2 rounded-lg border border-emerald-200">
                      <strong>Guaranteed Zero-Downtime:</strong> This native mathematical core executes autonomous stop clustering, Haversine travel corridors, and SLA emergency sorting without requiring an internet API connection.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Keys are stored locally in your browser session & never shared.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            Apply & Done
          </button>
        </div>
      </div>
    </div>
  );
};
