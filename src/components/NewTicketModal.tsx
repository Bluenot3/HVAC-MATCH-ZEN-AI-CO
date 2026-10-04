import React, { useState, useEffect, useRef } from 'react';
import { EquipmentType, ServiceTicket, UrgencyLevel } from '../types/dispatch';
import { AiAddressIntel } from '../types/zenAi';
import { zenAi, AI_PROVIDERS } from '../services/aiProviderService';
import { soundFx } from '../services/soundFx';
import { ZenLogo } from './brand/ZenLogo';
import { 
  Flame, 
  Clock, 
  Wrench, 
  Plus, 
  X, 
  Sparkles, 
  MapPin, 
  Navigation, 
  Loader2, 
  CheckCircle2, 
  Cpu 
} from 'lucide-react';

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTicket: (ticket: ServiceTicket) => void;
}

const DFW_PRESET_LOCATIONS = [
  { address: '2001 Ross Ave, Dallas, TX 75201', lat: 32.7885, lng: -96.7972, city: 'Dallas' },
  { address: '500 Main St, Fort Worth, TX 76102', lat: 32.7540, lng: -97.3310, city: 'Fort Worth' },
  { address: '6100 Tennyson Pkwy, Plano, TX 75024', lat: 33.0780, lng: -96.8250, city: 'Plano' },
  { address: '1200 E Copeland Rd, Arlington, TX 76011', lat: 32.7590, lng: -97.0980, city: 'Arlington' },
  { address: '8500 Freeport Pkwy, Irving, TX 75063', lat: 32.9150, lng: -96.9800, city: 'Irving' },
  { address: '9101 John Hickman Pkwy, Frisco, TX 75034', lat: 33.1150, lng: -96.8150, city: 'Frisco' },
];

export const NewTicketModal: React.FC<NewTicketModalProps> = ({
  isOpen,
  onClose,
  onCreateTicket,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('(214) 555-');
  const [email, setEmail] = useState('');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [customAddress, setCustomAddress] = useState(DFW_PRESET_LOCATIONS[0].address);
  const [urgency, setUrgency] = useState<UrgencyLevel>('EMERGENCY');
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('Commercial Chiller');
  const [equipmentModel, setEquipmentModel] = useState('');
  const [faultCode, setFaultCode] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(90);

  // AI Address Geocoding and Corridor Intelligence State
  const [isAiLocating, setIsAiLocating] = useState(false);
  const [aiIntel, setAiIntel] = useState<AiAddressIntel | null>(null);
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Keyboard navigation: Escape key closes modal (WCAG 2.1.2)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // AI-Powered Address Locator across all configured providers
  const handleAiLocateAddress = async () => {
    const addressToQuery = customAddress.trim() || DFW_PRESET_LOCATIONS[selectedPresetIdx].address;
    setIsAiLocating(true);
    soundFx.playSelectBlip();

    try {
      const intel = await zenAi.locateAddressIntel(addressToQuery);
      setAiIntel(intel);

      // Determine realistic DFW lat/lng coordinates based on query
      const basePreset = DFW_PRESET_LOCATIONS.find((loc) =>
        addressToQuery.toLowerCase().includes(loc.city.toLowerCase())
      ) || DFW_PRESET_LOCATIONS[selectedPresetIdx];

      const latOffset = (Math.random() - 0.5) * 0.015;
      const lngOffset = (Math.random() - 0.5) * 0.015;
      setResolvedCoords({
        lat: Number((basePreset.lat + latOffset).toFixed(4)),
        lng: Number((basePreset.lng + lngOffset).toFixed(4)),
      });

      if (intel.accessRecommendations && intel.accessRecommendations.length > 0) {
        setAccessNotes(intel.accessRecommendations.join('. '));
      }
      soundFx.playConfirm();
    } catch (err) {
      console.warn('AI Locate error, applying fallback:', err);
    } finally {
      setIsAiLocating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const locPreset = DFW_PRESET_LOCATIONS[selectedPresetIdx] || DFW_PRESET_LOCATIONS[0];
    const finalAddress = customAddress.trim() || locPreset.address;
    const finalLat = resolvedCoords?.lat || (locPreset.lat + (Math.random() - 0.5) * 0.02);
    const finalLng = resolvedCoords?.lng || (locPreset.lng + (Math.random() - 0.5) * 0.02);

    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const newTicket: ServiceTicket = {
      id: `ticket-${Date.now()}`,
      ticketNumber: `TK-${randomDigits}`,
      customerName: customerName.trim() || 'Urgent Commercial Facility',
      customerPhone: phone.trim() || '(214) 555-0199',
      customerEmail: email.trim() || 'facilities@metroplex.com',
      location: {
        lat: finalLat,
        lng: finalLng,
        address: finalAddress,
        city: locPreset.city,
      },
      urgency,
      status: 'UNASSIGNED',
      equipmentType,
      equipmentModel: equipmentModel.trim() || `${equipmentType} Pro-Series`,
      equipmentSerial: `SN-${Date.now().toString().slice(-6)}`,
      faultCode: faultCode.trim() || undefined,
      issueDescription: issueDescription.trim() || `Service call for ${equipmentType} diagnostics and repair.`,
      accessNotes: accessNotes.trim() || (aiIntel?.accessRecommendations ? aiIntel.accessRecommendations.join('. ') : undefined),
      requiredSkills: [equipmentType],
      requiredParts: [],
      slaDeadline: urgency === 'EMERGENCY' ? '1h 30m remaining (SLA: 2h)' : urgency === 'SAME_DAY' ? '5h remaining (SLA: 6h)' : '24h (SLA: 48h)',
      estimatedDurationMinutes: Number(durationMinutes) || 90,
      createdAt: new Date().toISOString(),
    };

    soundFx.playConfirm();
    onCreateTicket(newTicket);
    onClose();
  };

  const activeProvider = zenAi.getActiveProvider();
  const providerConfig = AI_PROVIDERS[activeProvider];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-ticket-modal-title"
    >
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-900 font-sans max-h-[94vh] flex flex-col">
        {/* Header with Official ZEN AI Co. Branding */}
        <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <ZenLogo size={32} variant="badge" />
            <div>
              <div className="flex items-center gap-2">
                <h2 id="new-ticket-modal-title" className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
                  ZEN AI Co. • Dispatch Ingestion
                </h2>
                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-cyan-300 font-mono text-[9px] font-bold border border-cyan-400/30">
                  {providerConfig?.name?.split(' ')[0] || 'Multi-AI'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Deploy new HVAC service ticket with autonomous geocoding &amp; corridor intelligence.
              </p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Close new ticket dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 text-xs bg-white overflow-y-auto flex-1">
          {/* Urgency Selector */}
          <div>
            <span id="urgency-group-label" className="font-bold text-slate-800 mb-1.5 block">
              Urgency Level &amp; Response SLA
            </span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="urgency-group-label">
              <button
                type="button"
                role="radio"
                aria-checked={urgency === 'EMERGENCY'}
                onClick={() => {
                  soundFx.playSelectBlip();
                  setUrgency('EMERGENCY');
                }}
                className={`min-h-[44px] p-2 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                  urgency === 'EMERGENCY'
                    ? 'bg-red-50 border-red-400 text-red-700 ring-2 ring-red-400 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Flame className="w-4 h-4 text-red-600 flex-shrink-0 animate-pulse" aria-hidden="true" />
                <span className="text-[11px] sm:text-xs">Emergency (&lt;2h)</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={urgency === 'SAME_DAY'}
                onClick={() => {
                  soundFx.playSelectBlip();
                  setUrgency('SAME_DAY');
                }}
                className={`min-h-[44px] p-2 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                  urgency === 'SAME_DAY'
                    ? 'bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-400 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" aria-hidden="true" />
                <span className="text-[11px] sm:text-xs">Same-Day (&lt;6h)</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={urgency === 'ROUTINE'}
                onClick={() => {
                  soundFx.playSelectBlip();
                  setUrgency('ROUTINE');
                }}
                className={`min-h-[44px] p-2 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                  urgency === 'ROUTINE'
                    ? 'bg-blue-50 border-blue-400 text-blue-700 ring-2 ring-blue-400 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Wrench className="w-4 h-4 text-blue-600 flex-shrink-0" aria-hidden="true" />
                <span className="text-[11px] sm:text-xs">Routine PM</span>
              </button>
            </div>
          </div>

          {/* Customer & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ticket-customer-name" className="font-semibold text-slate-700 mb-1 block">Facility / Customer</label>
              <input
                id="ticket-customer-name"
                type="text"
                required
                placeholder="e.g. Baylor Surgery Pavilion"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label htmlFor="ticket-contact-phone" className="font-semibold text-slate-700 mb-1 block">Contact Phone</label>
              <input
                id="ticket-contact-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
              />
            </div>
          </div>

          {/* AI Smart Location & Geocoding Resolver */}
          <div className="p-3 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-xl border border-blue-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Service Address &amp; Corridor Intelligence</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                ZEN AI Resolver
              </span>
            </div>

            {/* Custom Street Address Input with Quick AI Locate Button */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="Enter street address, landmark or city..."
                className="flex-1 min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAiLocateAddress}
                disabled={isAiLocating}
                className="min-h-[42px] px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap disabled:opacity-60"
                title="Use configured AI provider to analyze address coordinates and corridor transit"
              >
                {isAiLocating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Resolving...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                    <span>AI Locate</span>
                  </>
                )}
              </button>
            </div>

            {/* Preset Picker Dropdown */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>Or choose preset:</span>
              <select
                value={selectedPresetIdx}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setSelectedPresetIdx(idx);
                  setCustomAddress(DFW_PRESET_LOCATIONS[idx].address);
                  setResolvedCoords({
                    lat: DFW_PRESET_LOCATIONS[idx].lat,
                    lng: DFW_PRESET_LOCATIONS[idx].lng,
                  });
                  soundFx.playSelectBlip();
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none font-medium cursor-pointer"
              >
                {DFW_PRESET_LOCATIONS.map((loc, i) => (
                  <option key={i} value={i}>
                    {loc.city}: {loc.address}
                  </option>
                ))}
              </select>
            </div>

            {/* AI Address Intelligence Feedback Card */}
            {aiIntel && (
              <div className="p-2.5 bg-white rounded-lg border border-blue-200 shadow-2xs space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-blue-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Zone: {aiIntel.metroZone}</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 font-semibold">
                    via {aiIntel.providerUsed || 'ZEN AI Spatial Core'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Transit Corridor</span>
                    <span className="font-semibold text-slate-800">{aiIntel.primaryCorridor}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">GPS Coordinates</span>
                    <span className="font-mono font-bold text-blue-600">
                      {resolvedCoords ? `${resolvedCoords.lat}° N, ${Math.abs(resolvedCoords.lng)}° W` : '32.7885° N, 96.7972° W'}
                    </span>
                  </div>
                </div>

                {aiIntel.accessRecommendations && aiIntel.accessRecommendations.length > 0 && (
                  <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-200/80">
                    <span className="font-bold text-slate-700">Access Guidance: </span>
                    <span>{aiIntel.accessRecommendations.join(' • ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Equipment Type & Fault Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ticket-equipment-type" className="font-semibold text-slate-700 mb-1 block">HVAC Equipment</label>
              <select
                id="ticket-equipment-type"
                value={equipmentType}
                onChange={(e) => setEquipmentType(e.target.value as EquipmentType)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer font-medium"
              >
                <option value="Commercial Chiller">Commercial Chiller</option>
                <option value="Data Center CRAC / Precision Cooling">Data Center CRAC</option>
                <option value="Rooftop Package Unit (RTU)">Rooftop Unit (RTU)</option>
                <option value="VRF Multi-Split Heat Pump">VRF Multi-Split Heat Pump</option>
                <option value="Hydronic Commercial Boiler">Hydronic Commercial Boiler</option>
                <option value="High-Efficiency Gas Furnace">High-Efficiency Gas Furnace</option>
                <option value="Ductless Inverter Mini-Split">Ductless Mini-Split</option>
                <option value="Air Handling Unit (AHU) & VAV">AHU & VAV System</option>
              </select>
            </div>
            <div>
              <label htmlFor="ticket-fault-code" className="font-semibold text-slate-700 mb-1 block">Fault Code (Optional)</label>
              <input
                id="ticket-fault-code"
                type="text"
                placeholder="e.g. ERR-OIL-PR-LO"
                value={faultCode}
                onChange={(e) => setFaultCode(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="ticket-issue-desc" className="font-semibold text-slate-700 mb-1 block">Issue Description</label>
            <textarea
              id="ticket-issue-desc"
              rows={2}
              placeholder="Describe symptoms, temperature alarms, noise..."
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Create &amp; Enqueue Ticket</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
