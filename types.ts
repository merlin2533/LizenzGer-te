
export interface FeatureSet {
  [key: string]: boolean;
}

export type LicenseStatus = 'active' | 'expired' | 'suspended';

export interface ModuleDefinition {
  id: string;
  label: string;
  description: string;
  iconName: string; // Store string reference to icon registry
}

export interface License {
  id: string;
  organization: string;
  contactPerson: string;
  email: string;
  phoneNumber?: string; // New field
  domain: string; // z.B. ffw-musterstadt.de
  key: string;
  validUntil: string;
  status: LicenseStatus;
  features: FeatureSet;
  createdAt: string;
  note?: string; // New field for comments
}

export interface LicenseRequest {
  id: string;
  organization: string;
  contactPerson: string;
  email: string;
  phoneNumber?: string; // New field
  requestedDomain: string;
  requestDate: string;
  note?: string;
  customMessage?: string; // Custom message returned to API while pending
}

export interface ApiLogEntry {
  id: string;
  timestamp: string;
  method: 'POST';
  endpoint: string;
  sourceUrl: string; // The "Origin" or "Referer"
  providedKey?: string;
  responseStatus: 200 | 401 | 403 | 201;
  responseBody: string;
}

// Initial default features based on current config (fallback)
export const DEFAULT_FEATURES: FeatureSet = {
  inventory: true,
  respiratory: false,
  hoses: false,
  vehicles: false,
  apiAccess: false,
};