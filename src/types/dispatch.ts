export type UrgencyLevel = 'EMERGENCY' | 'SAME_DAY' | 'ROUTINE';

export type TechnicianStatus = 
  | 'AVAILABLE' 
  | 'EN_ROUTE' 
  | 'ON_SITE' 
  | 'RETURNING_DEPOT' 
  | 'ON_DUTY' 
  | 'OFF_DUTY';

export type TicketStatus = 
  | 'UNASSIGNED' 
  | 'ASSIGNED' 
  | 'EN_ROUTE' 
  | 'IN_PROGRESS' 
  | 'COMPLETED';

export type EquipmentType = 
  | 'Commercial Chiller' 
  | 'Rooftop Package Unit (RTU)' 
  | 'VRF Multi-Split Heat Pump' 
  | 'High-Efficiency Gas Furnace' 
  | 'Hydronic Commercial Boiler' 
  | 'Data Center CRAC / Precision Cooling' 
  | 'Ductless Inverter Mini-Split' 
  | 'Air Handling Unit (AHU) & VAV';

export interface LocationPoint {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  zip?: string;
}

export interface InventoryItem {
  partNumber: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface RouteMetrics {
  totalDistanceMiles: number;
  totalDriveMinutes: number;
  estimatedFuelGallons: number;
  stopCount: number;
  encodedPolyline?: string;
  legs?: Array<{
    distanceMeters: number;
    durationSeconds: number;
    fromAddress: string;
    toAddress: string;
  }>;
}

export interface Technician {
  id: string;
  name: string;
  vanNumber: string;
  phone: string;
  color: string;
  status: TechnicianStatus;
  rating: number;
  skills: string[];
  certifications: string[];
  experienceYears: number;
  currentLocation: LocationPoint;
  depotLocation: LocationPoint & { name: string };
  assignedTicketIds: string[];
  shiftCapacityHours: number;
  completedJobsCount: number;
  partsInventory: InventoryItem[];
  routeMetrics?: RouteMetrics;
  lastUpdated?: string;
}

export interface ServiceTicket {
  id: string;
  ticketNumber: string;
  customerName: string;
  companyName?: string;
  customerPhone: string;
  customerEmail: string;
  location: LocationPoint;
  urgency: UrgencyLevel;
  status: TicketStatus;
  assignedTechId?: string;
  equipmentType: EquipmentType;
  equipmentModel: string;
  equipmentSerial: string;
  faultCode?: string;
  issueDescription: string;
  accessNotes?: string;
  requiredSkills: string[];
  requiredParts: string[];
  slaDeadline: string;
  scheduledTimeWindow?: string;
  estimatedDurationMinutes: number;
  createdAt: string;
  stopSequence?: number;
}

export interface AIRecommendation {
  ticketId: string;
  ticketNumber: string;
  recommendedTechId: string;
  recommendedTechName: string;
  urgency: UrgencyLevel;
  rationale: string;
  estimatedDriveMins: number;
  urgencyLevelScore: number;
}

export interface AIAnalysisResult {
  summary: string;
  fleetHealth: string;
  estimatedFuelSavingsGallons: number;
  estimatedDriveTimeSavedMinutes: number;
  recommendations: AIRecommendation[];
  strategicInsights: string[];
}

export interface RouteCalculationRequest {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  intermediates?: Array<{ lat: number; lng: number }>;
  travelMode?: string;
}
