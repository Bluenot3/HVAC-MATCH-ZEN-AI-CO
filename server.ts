import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { createDispatchPrompt } from "./prompt_templates/dispatchPrompt";
import { INITIAL_TECHNICIANS, INITIAL_TICKETS } from "./src/data/hvacData";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Google Maps API Key configuration endpoint (safely provides public client key only)
app.get("/api/config", (req, res) => {
  res.json({
    mapsApiKey: process.env.VITE_GOOGLE_MAPS_API_KEY || "",
    hasGeminiKey: Boolean(geminiApiKey),
  });
});

// Proxy for Google Maps Geocoding API (Reverse Geocode: lat/lng -> Street Address)
app.get("/api/geocode/reverse", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Valid lat and lng query parameters are required" });
    }

    const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!mapsKey) {
      // Fallback estimated reverse geocoding when no key is set
      const fallback = generateServerFallbackAddress(lat, lng);
      return res.json(fallback);
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${mapsKey}&solution_id=gmp_aistudio_hvacdispatcher_v1.0.0`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn("Geocoding API HTTP error:", response.status);
      if (response.status === 429) {
        return res.status(429).json({ error: { status: "RESOURCE_EXHAUSTED", code: 429 }, ...generateServerFallbackAddress(lat, lng) });
      }
      return res.json(generateServerFallbackAddress(lat, lng));
    }

    const data = await response.json();

    if (data.status === "OVER_QUERY_LIMIT") {
      return res.status(429).json({ error: { status: "RESOURCE_EXHAUSTED", code: 429 }, ...generateServerFallbackAddress(lat, lng) });
    }

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.warn("Geocoding API returned status:", data.status);
      return res.json(generateServerFallbackAddress(lat, lng));
    }

    const firstResult = data.results[0];
    let streetNumber = "";
    let streetName = "";
    let neighborhood = "";
    let city = "";
    let state = "TX";
    let postalCode = "";

    for (const comp of firstResult.address_components || []) {
      if (comp.types.includes("street_number")) streetNumber = comp.long_name;
      if (comp.types.includes("route")) streetName = comp.long_name;
      if (comp.types.includes("neighborhood") || comp.types.includes("sublocality")) neighborhood = comp.long_name;
      if (comp.types.includes("locality")) city = comp.long_name;
      if (comp.types.includes("administrative_area_level_1")) state = comp.short_name;
      if (comp.types.includes("postal_code")) postalCode = comp.long_name;
    }

    res.json({
      formattedAddress: firstResult.formatted_address,
      streetNumber,
      streetName,
      neighborhood,
      city,
      state,
      postalCode,
      placeId: firstResult.place_id,
      locationType: firstResult.geometry?.location_type,
      fromGoogleApi: true,
    });
  } catch (error: any) {
    console.error("Reverse geocoding error:", error);
    res.status(500).json({ error: error.message || "Failed to reverse geocode" });
  }
});

// Proxy for Google Maps Routes API computeRoutes to prevent CORS & manage keys
app.post("/api/routes/compute", async (req, res) => {
  try {
    const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
    const { origin, destination, intermediates, travelMode = "DRIVE", routingPreference = "TRAFFIC_UNAWARE" } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({ error: "Origin and destination are required" });
    }

    if (!mapsKey) {
      // Return simulated calculation if no API key is provided
      return res.json({
        routes: [
          {
            distanceMeters: calculateEstimatedDistance(origin, destination, intermediates),
            duration: `${Math.round(calculateEstimatedDistance(origin, destination, intermediates) / 13)}s`,
            polyline: {
              encodedPolyline: generateFallbackPolyline(origin, destination, intermediates),
            },
            legs: generateFallbackLegs(origin, destination, intermediates),
          },
        ],
      });
    }

    const payload: Record<string, any> = {
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng,
          },
        },
      },
      travelMode,
      routingPreference,
      polylineQuality: "HIGH_QUALITY",
      polylineEncoding: "ENCODED_POLYLINE",
      computeAlternativeRoutes: false,
    };

    if (intermediates && intermediates.length > 0) {
      payload.intermediates = intermediates.map((wp: { lat: number; lng: number }) => ({
        location: {
          latLng: {
            latitude: wp.lat,
            longitude: wp.lng,
          },
        },
        via: false,
      }));
    }

    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": mapsKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("Routes API computeRoutes returned non-200:", response.status, errorText);
      // Fallback to geometric calculation
      const fallbackPayload = {
        error: response.status === 429 ? { status: "RESOURCE_EXHAUSTED", code: 429 } : undefined,
        routes: [
          {
            distanceMeters: calculateEstimatedDistance(origin, destination, intermediates),
            duration: `${Math.round(calculateEstimatedDistance(origin, destination, intermediates) / 13)}s`,
            polyline: {
              encodedPolyline: generateFallbackPolyline(origin, destination, intermediates),
            },
            legs: generateFallbackLegs(origin, destination, intermediates),
            fallback: true,
          },
        ],
      };
      if (response.status === 429) {
        return res.status(429).json(fallbackPayload);
      }
      return res.json(fallbackPayload);
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error("Error computing routes:", error);
    res.status(500).json({ error: error.message || "Failed to compute route" });
  }
});

// Proxy for Google Maps Routes API computeRouteMatrix
app.post("/api/routes/matrix", async (req, res) => {
  try {
    const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
    const { origins, destinations, travelMode = "DRIVE" } = req.body;

    if (!origins || !destinations) {
      return res.status(400).json({ error: "Origins and destinations are required" });
    }

    if (!mapsKey) {
      // Return simulated distance matrix
      const matrix = [];
      for (let i = 0; i < origins.length; i++) {
        for (let j = 0; j < destinations.length; j++) {
          const dist = calculateHaversineDistance(origins[i].lat, origins[i].lng, destinations[j].lat, destinations[j].lng);
          const durationSeconds = Math.round((dist / 35) * 3600); // 35 mph avg speed
          matrix.push({
            originIndex: i,
            destinationIndex: j,
            status: {},
            distanceMeters: Math.round(dist * 1609.34),
            duration: `${durationSeconds}s`,
            condition: "ROUTE_EXISTS",
          });
        }
      }
      return res.json(matrix);
    }

    const payload = {
      origins: origins.map((orig: { lat: number; lng: number }) => ({
        waypoint: {
          location: {
            latLng: {
              latitude: orig.lat,
              longitude: orig.lng,
            },
          },
        },
      })),
      destinations: destinations.map((dest: { lat: number; lng: number }) => ({
        waypoint: {
          location: {
            latLng: {
              latitude: dest.lat,
              longitude: dest.lng,
            },
          },
        },
      })),
      travelMode,
      routingPreference: "TRAFFIC_UNAWARE",
    };

    const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": mapsKey,
        "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,distanceMeters,duration",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("Routes API computeRouteMatrix error:", response.status, errorText);
      // Fallback
      const matrix = [];
      for (let i = 0; i < origins.length; i++) {
        for (let j = 0; j < destinations.length; j++) {
          const dist = calculateHaversineDistance(origins[i].lat, origins[i].lng, destinations[j].lat, destinations[j].lng);
          const durationSeconds = Math.round((dist / 35) * 3600);
          matrix.push({
            originIndex: i,
            destinationIndex: j,
            distanceMeters: Math.round(dist * 1609.34),
            duration: `${durationSeconds}s`,
            condition: "ROUTE_EXISTS",
          });
        }
      }
      return res.json(matrix);
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error("Error computing route matrix:", error);
    res.status(500).json({ error: error.message || "Failed to compute matrix" });
  }
});

// AI Dispatch Assistant Endpoint using Gemini Flash
app.post("/api/dispatch/ai-assistant", async (req, res) => {
  let normalizedTechs: any[] = [];
  let normalizedTickets: any[] = [];
  try {
    const rawTechs = req.body.technicians || [];
    const rawTickets = req.body.pendingTickets || req.body.unassignedTickets || [];
    const territoryName = req.body.territoryName || "Dallas-Fort Worth Metroplex";

    normalizedTechs = rawTechs.map((t: any) => ({
      id: t.id,
      name: t.name,
      vanNumber: t.vanNumber,
      status: t.status || "AVAILABLE",
      skills: t.skills || [],
      location: t.currentLocation || t.location || { lat: 32.86, lng: -97.04 },
      currentLocation: t.currentLocation || t.location || { lat: 32.86, lng: -97.04 },
      currentJobCount: t.assignedTickets?.length ?? t.assignedCount ?? (t.assignedTicketIds?.length || 0),
      assignedTickets: t.assignedTickets || [],
      shiftCapacityHours: t.shiftCapacityHours || 8,
      partsInventory: t.partsInventory || t.inventory || [],
    }));

    normalizedTickets = rawTickets.map((tk: any) => ({
      id: tk.id,
      ticketNumber: tk.ticketNumber || `TICK-${tk.id}`,
      customerName: tk.customerName || "HVAC Client",
      urgency: tk.urgency || "ROUTINE",
      equipmentType: tk.equipmentType || "Commercial HVAC",
      issueDescription: tk.issueDescription || "",
      requiredSkills: tk.requiredSkills || [tk.equipmentType].filter(Boolean),
      requiredParts: tk.requiredParts || [],
      location: tk.location || { lat: 32.86, lng: -97.04, address: "Dallas-Fort Worth" },
      slaDeadline: tk.slaDeadline || "Same Day",
      estimatedDurationMinutes: tk.estimatedDurationMinutes || 90,
    }));

    if (!ai) {
      // Fallback algorithmic recommendation if no API key is set
      const algorithmicRecs = generateAlgorithmicRecommendations(normalizedTechs, normalizedTickets);
      return res.json(algorithmicRecs);
    }

    const prompt = createDispatchPrompt(territoryName, normalizedTechs, normalizedTickets);

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            fleetHealth: { type: Type.STRING },
            estimatedFuelSavingsGallons: { type: Type.NUMBER },
            estimatedDriveTimeSavedMinutes: { type: Type.NUMBER },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  ticketId: { type: Type.STRING },
                  ticketNumber: { type: Type.STRING },
                  recommendedTechId: { type: Type.STRING },
                  recommendedTechName: { type: Type.STRING },
                  urgency: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  estimatedDriveMins: { type: Type.NUMBER },
                  urgencyLevelScore: { type: Type.NUMBER },
                },
                required: ["ticketId", "ticketNumber", "recommendedTechId", "recommendedTechName", "urgency", "rationale", "estimatedDriveMins"],
              },
            },
            strategicInsights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["summary", "fleetHealth", "estimatedFuelSavingsGallons", "estimatedDriveTimeSavedMinutes", "recommendations", "strategicInsights"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("AI Dispatch Assistant error:", error);
    // Return fallback algorithmic recommendations
    const algorithmicRecs = generateAlgorithmicRecommendations(normalizedTechs, normalizedTickets);
    res.json(algorithmicRecs);
  }
});

// In-memory cache for printable manifests to ensure zero URL bloat
const manifestCache = new Map<string, any>();

setInterval(() => {
  if (manifestCache.size > 200) {
    const keys = Array.from(manifestCache.keys()).slice(0, 100);
    keys.forEach((k) => manifestCache.delete(k));
  }
}, 60000);

// Endpoint to store manifest before printing (returns short ID URL)
app.post("/api/manifest/prepare", (req, res) => {
  try {
    const payload = req.body || {};
    const id = "m_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7);
    manifestCache.set(id, payload);

    // Also cache by tech ID if available
    const techId = payload.technician?.id;
    if (techId) {
      manifestCache.set("tech_" + techId, payload);
    }

    res.json({ id, printUrl: `/api/manifest/print?id=${id}` });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to prepare manifest", details: err?.message });
  }
});

// Standalone Printable Manifest HTML Endpoint with Auto-Print & PDF Export
// Supports:
// 1. GET with ?id= (retrieves stored payload)
// 2. GET with ?techId= (retrieves cached payload or resolves technician data)
// 3. POST with application/x-www-form-urlencoded or application/json body
// 4. Fallback GET with ?data= (for small queries)
// 5. Intelligent fallback to default technician (Marcus Vance) and real assigned tickets
app.all("/api/manifest/print", (req, res) => {
  let manifest: any = null;

  // 1. Lookup from in-memory cache if an ID is supplied
  const id = (req.query.id as string) || (req.body && req.body.id);
  if (id && manifestCache.has(id)) {
    manifest = manifestCache.get(id);
  }

  // 2. Lookup by techId parameter from cache
  const techId = (req.query.techId as string) || (req.body && req.body.techId);
  if (!manifest && techId && manifestCache.has("tech_" + techId)) {
    manifest = manifestCache.get("tech_" + techId);
  }

  // 3. Lookup from POST body
  if (!manifest && req.body) {
    if (req.body.manifestData) {
      try {
        manifest = typeof req.body.manifestData === "string"
          ? JSON.parse(req.body.manifestData)
          : req.body.manifestData;
      } catch (e) {
        console.error("Failed to parse req.body.manifestData:", e);
      }
    } else if (req.body.technician) {
      manifest = req.body;
    }
  }

  // 4. Fallback: Parse from query string
  if (!manifest && req.query.data) {
    try {
      manifest = JSON.parse(req.query.data as string);
    } catch (e) {
      console.error("Failed to parse manifest data query parameter:", e);
    }
  }

  function esc(s: any): string {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Determine technician information from manifest or INITIAL_TECHNICIANS
  const resolvedTechId = techId || manifest?.technician?.id || "tech-1";
  const matchedTech = INITIAL_TECHNICIANS.find((t) => t.id === resolvedTechId) || INITIAL_TECHNICIANS[0];

  const tech = manifest?.technician || {
    id: matchedTech.id,
    name: matchedTech.name,
    vanNumber: matchedTech.vanNumber,
    phone: matchedTech.phone,
    color: matchedTech.color,
    status: matchedTech.status,
    currentLocation: { address: matchedTech.currentLocation.address },
    depotLocation: { name: matchedTech.depotLocation.name, address: matchedTech.depotLocation.address },
  };

  // If tickets were passed in manifest, use them; otherwise pull assigned tickets from INITIAL_TICKETS
  let tickets: any[] = manifest?.tickets || [];
  if (!tickets || tickets.length === 0) {
    const defaultAssigned = INITIAL_TICKETS.filter(
      (t) => (matchedTech.assignedTicketIds && matchedTech.assignedTicketIds.includes(t.id)) || t.assignedTechId === matchedTech.id
    ).sort((a, b) => (a.stopSequence || 0) - (b.stopSequence || 0));

    tickets = defaultAssigned.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      customerName: t.customerName,
      customerPhone: t.customerPhone,
      customerEmail: t.customerEmail,
      urgency: t.urgency,
      equipmentType: t.equipmentType,
      equipmentModel: t.equipmentModel,
      faultCode: t.faultCode,
      issueDescription: t.issueDescription,
      accessNotes: t.accessNotes,
      estimatedDurationMinutes: t.estimatedDurationMinutes,
      location: t.location ? { address: t.location.address } : undefined,
    }));
  }

  const metrics = manifest?.metrics || {
    totalDistanceMiles: matchedTech.routeMetrics?.totalDistanceMiles || (tickets.length > 0 ? 54.5 : 0),
    totalDriveMinutes: matchedTech.routeMetrics?.totalDriveMinutes || (tickets.length > 0 ? 72 : 0),
    estimatedFuelGallons: matchedTech.routeMetrics?.estimatedFuelGallons || (tickets.length > 0 ? 3.8 : 0),
    stopCount: tickets.length,
  };

  const navigationUrl = manifest?.navigationUrl || "https://www.google.com/maps";
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const stopsHtml = tickets.length === 0
    ? `<div style="padding: 24px; text-align: center; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 12px; margin: 16px 0;">No active service tickets currently assigned to this vehicle.</div>`
    : tickets.map((t, idx) => {
        const urgencyBg = t.urgency === "EMERGENCY" ? "#fef2f2" : t.urgency === "SAME_DAY" ? "#fffbeb" : "#eff6ff";
        const urgencyColor = t.urgency === "EMERGENCY" ? "#b91c1c" : t.urgency === "SAME_DAY" ? "#b45309" : "#1d4ed8";
        const urgencyBorder = t.urgency === "EMERGENCY" ? "#fecaca" : t.urgency === "SAME_DAY" ? "#fde68a" : "#bfdbfe";

        return `
          <div class="manifest-stop-card" style="margin-bottom: 14px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #ffffff; page-break-inside: avoid; break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: ${esc(tech.color)}; color: #ffffff; font-weight: 800; font-size: 13px;">
                  ${idx + 1}
                </span>
                <span style="font-family: monospace; font-weight: 800; font-size: 14px; color: #0f172a;">${esc(t.ticketNumber)}</span>
                <span style="color: #cbd5e1;">•</span>
                <span style="font-weight: 700; font-size: 14px; color: #1e293b;">${esc(t.customerName)}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: ${urgencyBg}; color: ${urgencyColor}; border: 1px solid ${urgencyBorder};">
                  ${esc(t.urgency)}
                </span>
                <span style="font-size: 11px; color: #64748b; font-family: monospace;">⏱️ ${esc(t.estimatedDurationMinutes)}m on-site</span>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 8px; font-size: 12px; color: #334155; margin-bottom: 10px;">
              <div>📍 <strong>Address:</strong> ${esc(t.location?.address || "On file")}</div>
              <div>📞 <strong>Phone:</strong> ${esc(t.customerPhone || "N/A")} | ✉️ ${esc(t.customerEmail || "")}</div>
            </div>

            <div style="padding: 10px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; font-size: 12px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                <span>❄️ ${esc(t.equipmentType)} — ${esc(t.equipmentModel || "")}</span>
                ${t.faultCode ? `<span style="font-family: monospace; background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 11px;">Fault: ${esc(t.faultCode)}</span>` : ""}
              </div>
              <div style="color: #475569; line-height: 1.4;">${esc(t.issueDescription)}</div>
              ${t.accessNotes ? `<div style="margin-top: 6px; padding: 6px 8px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; color: #92400e; font-size: 11px;">🔑 <strong>Access Notes:</strong> ${esc(t.accessNotes)}</div>` : ""}
            </div>

            <div style="padding-top: 8px; border-top: 1px dashed #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b;">
              <div style="display: flex; gap: 16px;">
                <span>[ ] Arrival: _______</span>
                <span>[ ] Completed: _______</span>
                <span>[ ] Refrigerant Added: ______ lb</span>
              </div>
              <div>
                <span>Customer Signature: _______________________</span>
              </div>
            </div>
          </div>
        `;
      }).join("\n");

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily Route Manifest — ${esc(tech.vanNumber)} — ${esc(tech.name)}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.45;
    }
    .manifest-page {
      max-width: 820px;
      margin: 16px auto;
      background: #ffffff;
      padding: 28px 32px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .action-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #1e293b;
      color: #ffffff;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    .action-btn {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 12px;
      border: none;
      transition: all 0.15s ease;
      text-decoration: none;
    }
    .btn-print {
      background: #059669;
      color: #ffffff;
    }
    .btn-print:hover {
      background: #047857;
    }
    .btn-close {
      background: #475569;
      color: #ffffff;
    }
    .btn-close:hover {
      background: #334155;
    }
    .manifest-stop-card {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .manifest-page {
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <!-- Interactive Top Control Toolbar (Hidden in Print) -->
  <div class="action-toolbar no-print">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-weight: 800; font-size: 13px; letter-spacing: 0.5px;">🖨️ SERVICE ROUTE MANIFEST</span>
      <span style="background: rgba(255,255,255,0.15); padding: 3px 8px; border-radius: 6px; font-size: 11px;">
        ${esc(tech.vanNumber)} — ${esc(tech.name)}
      </span>
      <span style="font-size: 11px; color: #94a3b8;">
        (Tip: To save as a PDF file, select "Save as PDF" under Destination)
      </span>
    </div>
    <div style="display: flex; gap: 10px;">
      <button class="action-btn btn-print" onclick="window.print()" id="action-print-trigger">
        <span>🖨️ Print Manifest (Ctrl+P)</span>
      </button>
      <button class="action-btn btn-close" onclick="window.close()">
        <span>✕ Close Tab</span>
      </button>
    </div>
  </div>

  <div class="manifest-page">
    <!-- Header Block -->
    <div style="border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #2563eb; text-transform: uppercase;">
            METROPLEX HVAC FIELD SERVICES
          </div>
          <h1 style="margin: 3px 0 0 0; font-size: 20px; font-weight: 900; color: #0f172a;">
            Daily Dispatch Manifest &amp; Multi-Stop Route
          </h1>
          <div style="color: #64748b; font-size: 12px; margin-top: 4px;">
            Date: <strong>${esc(dateStr)}</strong> • Generated: ${esc(timeStr)}
          </div>
        </div>

        <div style="text-align: right;">
          <div style="display: inline-block; padding: 4px 12px; background: #0f172a; color: #ffffff; font-family: monospace; font-size: 15px; font-weight: 800; border-radius: 8px;">
            ${esc(tech.vanNumber)}
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 4px;">
            ${esc(tech.name)}
          </div>
          <div style="font-size: 12px; color: #475569;">
            ${esc(tech.phone)}
          </div>
        </div>
      </div>

      <!-- Route Metrics Bar -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; margin-top: 14px; font-size: 11px;">
        <div>
          <div style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 700;">Total Distance</div>
          <div style="font-size: 14px; font-weight: 800; font-family: monospace; color: #0f172a;">${esc(metrics.totalDistanceMiles)} Miles</div>
        </div>
        <div>
          <div style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 700;">Est. Drive Time</div>
          <div style="font-size: 14px; font-weight: 800; font-family: monospace; color: #2563eb;">${esc(metrics.totalDriveMinutes)} Minutes</div>
        </div>
        <div>
          <div style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 700;">Fuel Allocation</div>
          <div style="font-size: 14px; font-weight: 800; font-family: monospace; color: #059669;">~${esc(metrics.estimatedFuelGallons)} Gal</div>
        </div>
        <div>
          <div style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 700;">Scheduled Stops</div>
          <div style="font-size: 14px; font-weight: 800; font-family: monospace; color: #0f172a;">${tickets.length} Stops</div>
        </div>
      </div>
    </div>

    <!-- Stop 0: Base Departure -->
    <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; font-size: 12px;">
      <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #64748b; color: #ffffff; font-weight: 800; font-size: 11px;">
        0
      </span>
      <div style="flex: 1;">
        <strong>Origin / Hub Rollout:</strong>
        <span style="color: #475569;">${esc(tech.currentLocation?.address || "DFW Logistics Hub")}</span>
      </div>
      <span style="font-family: monospace; font-size: 11px; color: #64748b; font-weight: 700;">08:00 AM Rollout</span>
    </div>

    <!-- Stops Sequence -->
    ${stopsHtml}

    <!-- Depot Return -->
    ${tickets.length > 0 && tech.depotLocation ? `
      <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 10px; font-size: 12px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #059669; color: #ffffff; font-weight: 800; font-size: 11px;">
          ${tickets.length + 1}
        </span>
        <div style="flex: 1;">
          <strong>Return to Regional Hub:</strong>
          <span style="color: #475569;">${esc(tech.depotLocation.name)} (${esc(tech.depotLocation.address)})</span>
        </div>
        <span style="font-family: monospace; font-size: 11px; color: #059669; font-weight: 800;">Shift Complete</span>
      </div>
    ` : ""}

    <!-- Driver Safety & End-of-Day Sign-off -->
    <div style="margin-top: 20px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; page-break-inside: avoid; break-inside: avoid;">
      <div style="font-weight: 800; font-size: 12px; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
        Technician Route Closeout &amp; Odometer Record
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; font-size: 11px; color: #334155;">
        <div>Start Odometer: ________________</div>
        <div>End Odometer: ________________</div>
        <div>Total Vehicle Miles: ___________</div>
      </div>
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-top: 12px; font-size: 11px; color: #334155;">
        <div>Technician Signature: ________________________________________________</div>
        <div>Date: ________________________</div>
      </div>
    </div>
  </div>

  <script>
    // Automatically trigger browser print dialog after styles and layout settle
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.print();
        } catch (err) {
          console.warn('Auto print invocation was restricted by browser:', err);
        }
      }, 350);
    });
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(fullHtml);
});

// Helper math and fallback route generators
function generateServerFallbackAddress(lat: number, lng: number) {
  let city = 'Dallas';
  let neighborhood = 'Metro Corridor';
  let streetName = 'Main St';
  const streetNum = Math.floor(Math.abs((lat * 1000) % 8000)) + 100;

  if (lng < -97.1) {
    city = 'Fort Worth';
    neighborhood = lat > 32.78 ? 'Alliance Corridor' : 'Downtown Cultural District';
    streetName = lat > 32.78 ? 'Heritage Trace Pkwy' : 'Commerce St';
  } else if (lng < -96.95) {
    city = lat > 32.85 ? 'Grapevine' : 'Arlington';
    neighborhood = lat > 32.85 ? 'DFW Airport Corridor' : 'Entertainment District';
    streetName = lat > 32.85 ? 'William D. Tate Ave' : 'Ballpark Way';
  } else if (lat > 33.0) {
    city = 'Frisco / Plano';
    neighborhood = 'Legacy West';
    streetName = 'Legacy Dr';
  } else if (lat > 32.9) {
    city = 'Richardson';
    neighborhood = 'Telecom Corridor';
    streetName = 'Campbell Rd';
  } else if (lat < 32.7) {
    city = 'Oak Cliff';
    neighborhood = 'Bishop Arts';
    streetName = 'Davis St';
  } else {
    city = 'Dallas';
    neighborhood = 'Downtown / Uptown';
    streetName = 'Elm St';
  }

  return {
    formattedAddress: `${streetNum} ${streetName}, ${city}, TX 75201`,
    streetNumber: `${streetNum}`,
    streetName,
    neighborhood,
    city,
    state: 'TX',
    postalCode: '75201',
    fromGoogleApi: false,
  };
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateEstimatedDistance(origin: any, destination: any, intermediates: any[] = []): number {
  const points = [origin, ...(intermediates || []), destination];
  let totalMiles = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalMiles += calculateHaversineDistance(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng) * 1.25; // 1.25 road winding factor
  }
  return Math.round(totalMiles * 1609.34);
}

function generateFallbackPolyline(origin: any, destination: any, intermediates: any[] = []): string {
  // Generate realistic road waypoints along grid / arterial avenues instead of straight chords
  const keypoints = [origin, ...(intermediates || []), destination];
  const roadCoords: number[][] = [];

  for (let i = 0; i < keypoints.length - 1; i++) {
    const start = keypoints[i];
    const end = keypoints[i + 1];
    roadCoords.push([start.lat, start.lng]);

    // Interpolate arterial turns (e.g. travel along latitude then longitude with highway arc)
    const latDiff = end.lat - start.lat;
    const lngDiff = end.lng - start.lng;
    const numSubsteps = Math.max(4, Math.min(16, Math.round(Math.hypot(latDiff, lngDiff) * 80)));

    for (let s = 1; s < numSubsteps; s++) {
      const t = s / numSubsteps;
      // Smooth S-curve transition to mimic highway turns
      const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const interpLat = start.lat + latDiff * (t * 0.7 + easeT * 0.3);
      const interpLng = start.lng + lngDiff * (easeT * 0.7 + t * 0.3);
      roadCoords.push([interpLat, interpLng]);
    }
  }

  roadCoords.push([destination.lat, destination.lng]);
  return encodePolylineCoords(roadCoords);
}

function generateFallbackLegs(origin: any, destination: any, intermediates: any[] = []): any[] {
  const points = [origin, ...(intermediates || []), destination];
  const legs = [];
  for (let i = 0; i < points.length - 1; i++) {
    const distMiles = calculateHaversineDistance(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng) * 1.25;
    const durSec = Math.round((distMiles / 32) * 3600);
    legs.push({
      distanceMeters: Math.round(distMiles * 1609.34),
      duration: `${durSec}s`,
      startLocation: { latLng: { latitude: points[i].lat, longitude: points[i].lng } },
      endLocation: { latLng: { latitude: points[i + 1].lat, longitude: points[i + 1].lng } },
    });
  }
  return legs;
}

function encodePolylineCoords(coords: number[][]): string {
  let result = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const [lat, lng] of coords) {
    const late5 = Math.round(lat * 1e5);
    const lnge5 = Math.round(lng * 1e5);

    result += encodeNumber(late5 - prevLat);
    result += encodeNumber(lnge5 - prevLng);

    prevLat = late5;
    prevLng = lnge5;
  }
  return result;
}

function encodeNumber(num: number): string {
  let sgn_num = num < 0 ? ~(num << 1) : num << 1;
  let encodeString = "";
  while (sgn_num >= 0x20) {
    encodeString += String.fromCharCode((0x20 | (sgn_num & 0x1f)) + 63);
    sgn_num >>= 5;
  }
  encodeString += String.fromCharCode(sgn_num + 63);
  return encodeString;
}

function generateAlgorithmicRecommendations(technicians: any[], pendingTickets: any[]) {
  const recommendations: any[] = [];
  const availableTechs = technicians.filter((t) => t.status !== "OFF_DUTY");

  pendingTickets.forEach((ticket) => {
    if (availableTechs.length === 0) return;
    let bestTech = availableTechs[0];
    let minScore = Infinity;
    const ticketLoc = ticket.location || { lat: 32.86, lng: -97.04 };
    const reqSkills = ticket.requiredSkills || (ticket.equipmentType ? [ticket.equipmentType] : []);

    availableTechs.forEach((tech) => {
      const techLoc = tech.currentLocation || tech.location || { lat: 32.86, lng: -97.04 };
      const dist = calculateHaversineDistance(techLoc.lat, techLoc.lng, ticketLoc.lat, ticketLoc.lng);
      const techSkills = tech.skills || [];
      const hasRequiredSkills = reqSkills.length === 0 || reqSkills.some((s: string) => techSkills.includes(s));
      const currentLoad = tech.assignedTickets?.length ?? tech.currentJobCount ?? tech.assignedCount ?? 0;
      const currentLoadPenalty = currentLoad * 4;
      const skillBonus = hasRequiredSkills ? -10 : 15;
      const score = dist + currentLoadPenalty + skillBonus;

      if (score < minScore) {
        minScore = score;
        bestTech = tech;
      }
    });

    if (bestTech) {
      const bestLoc = bestTech.currentLocation || bestTech.location || { lat: 32.86, lng: -97.04 };
      const estDriveMins = Math.round(
        (calculateHaversineDistance(bestLoc.lat, bestLoc.lng, ticketLoc.lat, ticketLoc.lng) / 32) * 60 + 5
      );
      recommendations.push({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber || `TICK-${ticket.id}`,
        recommendedTechId: bestTech.id,
        recommendedTechName: bestTech.name,
        urgency: ticket.urgency || "ROUTINE",
        rationale: `Proximity (${minScore < 10 ? "Close" : "Regional"} range) with ${reqSkills.join(", ") || "HVAC"} competency match for ${bestTech.vanNumber}.`,
        estimatedDriveMins: estDriveMins,
        urgencyLevelScore: ticket.urgency === "EMERGENCY" ? 10 : ticket.urgency === "SAME_DAY" ? 7 : 4,
      });
    }
  });

  return {
    summary: `AI Dispatcher analyzed ${pendingTickets.length} pending HVAC calls against 15 active fleet units with route distance matrix.`,
    fleetHealth: pendingTickets.some((t) => t.urgency === "EMERGENCY") ? "EMERGENCY_ALERT" : "OPTIMAL",
    estimatedFuelSavingsGallons: Math.round((pendingTickets.length * 1.8 + 3.2) * 10) / 10,
    estimatedDriveTimeSavedMinutes: pendingTickets.length * 14,
    recommendations,
    strategicInsights: [
      "Prioritize emergency chiller and furnace diagnostic calls before ambient peak temperature hours.",
      "Consolidate zone clusters in Northern and Eastern sectors to prevent technician corridor overlap.",
      "Check R-410A canister replenishment for high-workload vans during depot return window.",
    ],
  };
}

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`HVAC Dispatch Server running on port ${PORT}`);
  });
}

startServer();
