
import { License, LicenseRequest, ApiLogEntry, FeatureSet, ModuleDefinition } from '../types';

// API Configuration - stored in localStorage
let apiUrl: string | null = null;
let adminSecret: string | null = null;

// Initialize configuration from localStorage
const initConfig = () => {
  if (!apiUrl) apiUrl = localStorage.getItem('apiUrl') || '';
  if (!adminSecret) adminSecret = localStorage.getItem('adminSecret') || '123456';
};

// Helper: Make authenticated API call
const apiCall = async (action: string, data: any = {}): Promise<any> => {
  initConfig();

  if (!apiUrl) {
    throw new Error('API URL not configured. Please set it in Settings.');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      secret: adminSecret,
      ...data
    })
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(result.error);
  }

  return result;
};

// ==================== INITIALIZATION ====================

export const initDatabase = async (): Promise<void> => {
  // No longer needed - we use the server database directly
  // Just ensure config is loaded
  initConfig();
  console.log('[Database] Using server-side database. No local initialization needed.');
};

// ==================== SETTINGS ====================

export const getSetting = async (key: string): Promise<string | null> => {
  // Settings are stored in localStorage (not server)
  return localStorage.getItem(key);
};

export const saveSetting = async (key: string, value: string): Promise<void> => {
  localStorage.setItem(key, value);

  // Refresh config if API-related settings changed
  if (key === 'apiUrl') apiUrl = value;
  if (key === 'adminSecret') adminSecret = value;
};

// ==================== MODULES ====================

export const getModules = async (): Promise<ModuleDefinition[]> => {
  const result = await apiCall('get_modules');
  return result.data || [];
};

export const addModule = async (module: ModuleDefinition): Promise<void> => {
  // Modules are defined in PHP config, not editable from frontend currently
  console.warn('[Database] addModule not implemented - modules are configured in PHP');
};

export const deleteModule = async (id: string): Promise<void> => {
  // Modules are defined in PHP config, not editable from frontend currently
  console.warn('[Database] deleteModule not implemented - modules are configured in PHP');
};

// ==================== LICENSES ====================

export const getLicenses = async (): Promise<License[]> => {
  const result = await apiCall('get_licenses');
  return result.data || [];
};

export const createLicense = async (license: License): Promise<void> => {
  await apiCall('create_license', { license });
};

export const updateLicenseFeatures = async (id: string, features: FeatureSet): Promise<void> => {
  await apiCall('update_license_features', { id, features });
};

export const updateLicenseDetails = async (id: string, details: Partial<License>): Promise<void> => {
  // Get current license first
  const licenses = await getLicenses();
  const currentLicense = licenses.find(l => l.id === id);

  if (!currentLicense) {
    throw new Error(`License ${id} not found`);
  }

  // Merge with updates
  const updatedLicense = { ...currentLicense, ...details };

  await apiCall('update_license', { license: updatedLicense });
};

export const revokeLicense = async (id: string): Promise<void> => {
  await apiCall('revoke_license', { id });
};

export const deleteLicense = async (id: string): Promise<void> => {
  await apiCall('delete_license', { id });
};

export const findLicenseByKey = async (key: string): Promise<License | null> => {
  const licenses = await getLicenses();
  return licenses.find(l => l.key === key) || null;
};

export const findLicenseByDomain = async (domain: string): Promise<License | null> => {
  const licenses = await getLicenses();
  return licenses.find(l => l.domain.toLowerCase() === domain.toLowerCase()) || null;
};

// ==================== REQUESTS ====================

export const getRequests = async (): Promise<LicenseRequest[]> => {
  const result = await apiCall('get_requests');
  return result.data || [];
};

export const createRequest = async (request: LicenseRequest): Promise<void> => {
  // Requests are auto-created by public API, not by admin
  console.warn('[Database] createRequest - requests are created by public API');
};

export const updateRequest = async (request: LicenseRequest): Promise<void> => {
  await apiCall('update_request', { request });
};

export const deleteRequest = async (id: string): Promise<void> => {
  await apiCall('delete_request', { id });
};

export const findRequestByDomain = async (domain: string): Promise<LicenseRequest | null> => {
  const requests = await getRequests();
  return requests.find(r => r.requestedDomain.toLowerCase() === domain.toLowerCase()) || null;
};

// ==================== LOGS ====================

export const getLogs = async (): Promise<ApiLogEntry[]> => {
  const result = await apiCall('get_logs');
  return result.data || [];
};

export const addLog = async (log: ApiLogEntry): Promise<void> => {
  // Logs are created by the PHP backend automatically
  console.warn('[Database] addLog - logs are created on server side');
};

// ==================== LEGACY / COMPATIBILITY ====================

export const getRawTableData = async (tableName: string): Promise<any[]> => {
  // For DB inspector - get data based on table name
  if (tableName === 'licenses') return await getLicenses();
  if (tableName === 'requests') return await getRequests();
  if (tableName === 'logs') return await getLogs();
  if (tableName === 'settings') {
    // Return settings from localStorage
    return [
      { key: 'apiUrl', value: localStorage.getItem('apiUrl') || '' },
      { key: 'adminSecret', value: '***' }
    ];
  }
  return [];
};

// No longer needed with server-only database:
export const downloadDatabaseFile = async (): Promise<void> => {
  alert('Database download is not available in API mode. The database is stored on the server.');
};

export const uploadDatabaseFile = async (file: File): Promise<void> => {
  alert('Database upload is not available in API mode. The database is stored on the server.');
};

export const mergeExternalData = async (
  externalLicenses: any[],
  externalRequests: any[],
  externalLogs?: any[]
): Promise<void> => {
  // No longer needed - we access server DB directly
  console.warn('[Database] mergeExternalData - Not needed with direct server access');
};