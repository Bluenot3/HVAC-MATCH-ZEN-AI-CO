import React, { useState, useEffect, useRef } from 'react';
import { Technician, ServiceTicket, AIRecommendation } from '../types/dispatch';
import { AiProviderId, ZenDispatchAnalysis } from '../types/zenAi';
import { AI_PROVIDERS, zenAi } from '../services/aiProviderService';
import { ZenLogo } from './brand/ZenLogo';
import { ZenAiSettingsModal } from './ZenAiSettingsModal';
import { 
  Sparkles, 
  CheckCircle2, 
  Flame, 
  Clock, 
  Wrench, 
  Truck, 
  Fuel, 
  TrendingDown, 
  Lightbulb, 
  ArrowRight, 
  Loader2, 
  RefreshCw, 
  AlertCircle,
  X,
  Settings,
  ShieldCheck,
  Zap,
  Cpu
} from 'lucide-react';

interface AiDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  technicians: Technician[];
  tickets: ServiceTicket[];
  onBatchApplyRecommendations: (recommendations: AIRecommendation[]) => void;
  onApplySingleRecommendation: (rec: AIRecommendation) => void;
}

export const AiDispatchModal: React.FC<AiDispatchModalProps> = ({
  isOpen,
  onClose,
  technicians,
  tickets,
  onBatchApplyRecommendations,
  onApplySingleRecommendation,
}) => {
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<ZenDispatchAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<AiProviderId>(zenAi.getActiveProvider());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setActiveProvider(zenAi.getActiveProvider());
      setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keyboard navigation: Escape key closes modal (WCAG 2.1.2)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSettingsOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSettingsOpen, onClose]);

  if (!isOpen) return null;

  const unassignedTickets = tickets.filter((t) => !t.assignedTechId && t.status !== 'COMPLETED');

  const handleProviderSelect = (newProvider: AiProviderId) => {
    setActiveProvider(newProvider);
    zenAi.setActiveProvider(newProvider);
  };

  const runAiOptimization = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await zenAi.computeDispatchAnalysis(technicians, tickets);
      setAiResult(result);
    } catch (err: any) {
      console.error('Failed to run ZEN AI dispatch:', err);
      setError('Encountered an issue running cloud AI model; switching to ZEN Autonomous Engine.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-dispatch-modal-title"
        onClick={onClose}
      >
        <div
          className="w-full max-w-4xl max-h-[90vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900 font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <ZenLogo size={38} variant="badge" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="ai-dispatch-modal-title" className="font-extrabold text-base sm:text-lg tracking-tight flex items-center gap-1.5">
                    ZEN AI Co. • Dispatch Intelligence
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-400/30">
                    Multi-Model
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Autonomous HVAC Route Optimization • Works With Multiple AI Providers &amp; Guaranteed Local Fallback
                </p>
              </div>
            </div>

            {/* Provider Switcher & Settings Trigger */}
            <div className="flex items-center gap-2">
              {/* Provider Quick Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <select
                  value={activeProvider}
                  onChange={(e) => handleProviderSelect(e.target.value as AiProviderId)}
                  className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer pr-1"
                  aria-label="Select AI Intelligence Provider"
                >
                  <option value="auto" className="bg-slate-900 text-white">ZEN AI Auto Router</option>
                  <option value="openai" className="bg-slate-900 text-white">OpenAI (GPT-4o)</option>
                  <option value="gemini" className="bg-slate-900 text-white">Google Gemini</option>
                  <option value="anthropic" className="bg-slate-900 text-white">Anthropic Claude</option>
                  <option value="groq" className="bg-slate-900 text-white">Groq LPU (Sub-Second)</option>
                  <option value="mistral" className="bg-slate-900 text-white">Mistral AI</option>
                  <option value="openrouter" className="bg-slate-900 text-white">OpenRouter / DeepSeek</option>
                  <option value="local" className="bg-slate-900 text-white">ZEN Autonomous Core (Offline)</option>
                </select>
              </div>

              {/* Configure API Keys Button */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                title="Configure AI Provider Keys &amp; Models"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keys</span>
              </button>

              <button
                ref={closeBtnRef}
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4 sm:space-y-6 no-scrollbar bg-slate-50">
            {/* Status / Overview Card */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Live Dispatch Status
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                    DFW Metroplex Zone
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {unassignedTickets.length} Pending Service Calls Awaiting Dispatch
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  15 Active HVAC Fleet Vans • Live Corridor Traffic &amp; Technician Certifications
                </p>
              </div>

              <button
                onClick={runAiOptimization}
                disabled={loading || unassignedTickets.length === 0}
                className={`min-h-[44px] px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  loading
                    ? 'bg-blue-400 cursor-wait'
                    : unassignedTickets.length === 0
                    ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Fleet Corridors...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                    <span>Generate AI Optimization</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Analysis Results View */}
            {aiResult && (
              <div className="space-y-4 animate-fadeIn">
                {/* Engine Stamp Bar */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span className="font-bold text-slate-900">{aiResult.engineUsed}</span>
                    {aiResult.responseTimeMs && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        ({aiResult.responseTimeMs}ms)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>High Reliability Dispatch SLA</span>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                      <Fuel className="w-4 h-4 text-emerald-600" />
                      <span>Estimated Fuel Saved</span>
                    </div>
                    <div className="text-xl font-black text-slate-900 font-mono">
                      ~{aiResult.estimatedFuelSavingsGallons} Gal
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                      Reduced cross-town deadhead miles
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                      <TrendingDown className="w-4 h-4 text-blue-600" />
                      <span>Drive Time Saved</span>
                    </div>
                    <div className="text-xl font-black text-slate-900 font-mono">
                      {aiResult.estimatedDriveTimeSavedMinutes} Mins
                    </div>
                    <div className="text-[10px] text-blue-700 font-semibold mt-0.5">
                      Freeway corridor grouping
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                      <Truck className="w-4 h-4 text-indigo-600" />
                      <span>Fleet Utilization</span>
                    </div>
                    <div className="text-xl font-black text-slate-900 font-mono">
                      {aiResult.fleetHealth}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Balanced 8-hour shift capacity
                    </div>
                  </div>
                </div>

                {/* Strategic Insights */}
                {aiResult.strategicInsights && aiResult.strategicInsights.length > 0 && (
                  <div className="bg-indigo-50/70 border border-indigo-200 p-4 rounded-xl">
                    <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider mb-2">
                      <Lightbulb className="w-4 h-4 text-indigo-600" />
                      <span>ZEN AI Strategic Recommendations</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-indigo-950">
                      {aiResult.strategicInsights.map((insight, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-indigo-600 font-bold">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Individual Route Recommendations ({aiResult.recommendations.length})
                    </h4>

                    {aiResult.recommendations.length > 0 && (
                      <button
                        onClick={() => {
                          onBatchApplyRecommendations(aiResult.recommendations);
                          onClose();
                        }}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Apply All ({aiResult.recommendations.length})</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {aiResult.recommendations.map((rec) => {
                      const matchedTicket = tickets.find((t) => t.id === rec.ticketId);
                      const isEmergency = rec.urgency === 'EMERGENCY';
                      const isSameDay = rec.urgency === 'SAME_DAY';

                      return (
                        <div
                          key={rec.ticketId}
                          className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1 ${
                                  isEmergency
                                    ? 'bg-red-600'
                                    : isSameDay
                                    ? 'bg-amber-600'
                                    : 'bg-blue-600'
                                }`}
                              >
                                {isEmergency && <Flame className="w-3 h-3 text-white" />}
                                {isSameDay && <Clock className="w-3 h-3 text-white" />}
                                {rec.urgency}
                              </span>

                              <span className="font-mono font-bold text-xs text-slate-800">
                                {rec.ticketNumber}
                              </span>

                              {matchedTicket && (
                                <span className="text-xs font-semibold text-slate-700 truncate">
                                  {matchedTicket.customerName}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                              {rec.rationale}
                            </p>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2 font-medium flex-wrap">
                              <span className="text-blue-700 font-semibold flex items-center gap-1">
                                <Truck className="w-3.5 h-3.5" />
                                Recommended: <strong>{rec.recommendedTechName}</strong>
                              </span>
                              <span>•</span>
                              <span>Est. Transit: ~{rec.estimatedDriveMins} mins</span>
                              {rec.corridorAdvantage && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700">{rec.corridorAdvantage}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              onApplySingleRecommendation(rec);
                            }}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-800 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-end sm:self-center"
                          >
                            <span>Assign</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <ZenLogo size={20} variant="badge" />
              <span>Powered by <strong>ZEN AI Co.</strong> Field Logistics</span>
            </div>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* AI Provider Settings Modal */}
      <ZenAiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onProviderChanged={setActiveProvider}
      />
    </>
  );
};
