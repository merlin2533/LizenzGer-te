
import { License, LicenseRequest, ApiLogEntry, FeatureSet, DEFAULT_FEATURES, ModuleDefinition } from '../types';
import { DEFAULT_MODULES_SEED } from '../config';

// Define the shape of the sql.js library
declare global {
  interface Window {
    initSqlJs: (config: any) => Promise<any>;
  }
}

let db: any = null;

// Initialize the Database
export const initDatabase = async (): Promise<void> => {
  if (db) return;

  try {
    const SQL = await window.initSqlJs({
      locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });

    // Load from LocalStorage if available (simulating server file persistence)
    const savedDb = localStorage.getItem('ffw_license_db');
    if (savedDb) {
      const binaryArray = new Uint8Array(JSON.parse(savedDb));
      db = new SQL.Database(binaryArray);
      
      // Migration check: Ensure modules table exists for old DBs
      ensureTablesExist();
    } else {
      db = new SQL.Database();
      seedDatabase();
    }
  } catch (err) {
    console.error("Failed to initialize SQLite:", err);
    throw err;
  }
};

const ensureTablesExist = () => {
    // Check if modules table exists, if not create it
    try {
        db.run(`
            CREATE TABLE IF NOT EXISTS modules (
              id TEXT PRIMARY KEY,
              label TEXT,
              description TEXT,
              iconName TEXT
            );
        `);
        
        db.run(`
            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT
            );
        `);
        
        // MIGRATION: Add phoneNumber column if it doesn't exist
        try {
            db.run("ALTER TABLE licenses ADD COLUMN phoneNumber TEXT");
        } catch (e) {
            // Column likely exists or other error we can ignore for now in this context
        }
        
        try {
             db.run("ALTER TABLE requests ADD COLUMN phoneNumber TEXT");
        } catch (e) {
             // Column likely exists
        }

        // Check if modules table is empty, if so, seed it
        const res = db.exec("SELECT count(*) as count FROM modules");
        if (res.length > 0 && res[0].values[0][0] === 0) {
            seedModules();
        }

        // Check if settings need default
        const setRes = db.exec("SELECT count(*) as count FROM settings");
        if (setRes.length > 0 && setRes[0].values[0][0] === 0) {
             db.run(`INSERT OR IGNORE INTO settings VALUES ('apiUrl', 'https://api.geratewart-manager.de/v1/license/verify');`);
        }

    } catch (e) {
        console.error("Error ensuring tables exist", e);
    }
}

// Create tables and initial data
const seedDatabase = () => {
  // Create Tables
  db.run(`
    CREATE TABLE IF NOT EXISTS licenses (
      id TEXT PRIMARY KEY,
      organization TEXT,
      contactPerson TEXT,
      email TEXT,
      domain TEXT,
      key TEXT,
      validUntil TEXT,
      status TEXT,
      features TEXT,
      createdAt TEXT,
      phoneNumber TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      organization TEXT,
      contactPerson TEXT,
      email TEXT,
      requestedDomain TEXT,
      requestDate TEXT,
      note TEXT,
      phoneNumber TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      method TEXT,
      endpoint TEXT,
      sourceUrl TEXT,
      providedKey TEXT,
      responseStatus INTEGER,
      responseBody TEXT
    );
  `);

  ensureTablesExist(); // Creates modules, settings tables, and migrations

  // Insert Seed Data
  const initialFeatures = JSON.stringify({ ...DEFAULT_FEATURES, respiratory: true, vehicles: true, reports: true });
  db.run(`
    INSERT INTO licenses (id, organization, contactPerson, email, domain, key, validUntil, status, features, createdAt, phoneNumber) VALUES (
      'lic_1', 
      'Berufsfeuerwehr Großstadt', 
      'Leitstelle', 
      'admin@bf-grossstadt.de', 
      'bf-grossstadt.de', 
      'FFW-X9K2-M3P9-2024', 
      '2025-12-31', 
      'active', 
      '${initialFeatures}', 
      '2024-01-15',
      '+49 30 112233'
    );
  `);

  db.run(`
    INSERT INTO requests (id, organization, contactPerson, email, requestedDomain, requestDate, note) VALUES (
      'req_1',
      'Freiwillige Feuerwehr Musterstadt',
      'Hans Müller',
      'h.mueller@ffw-musterstadt.de',
      'ffw-musterstadt.de', 
      '${new Date().toISOString()}',
      'Wir benötigen dringend das Modul für Atemschutzüberwachung.'
    );
  `);
  
  saveDatabase();
};

const seedModules = () => {
    const stmt = db.prepare("INSERT INTO modules VALUES (?, ?, ?, ?)");
    DEFAULT_MODULES_SEED.forEach(m => {
        stmt.run([m.id, m.label, m.description, m.iconName]);
    });
    stmt.free();
    saveDatabase();
}

// Persist DB to LocalStorage
const saveDatabase = () => {
  const data = db.export();
  const json = JSON.stringify(Array.from(data));
  localStorage.setItem('ffw_license_db', json);
};

export const uploadDatabaseFile = async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const Uints = new Uint8Array(reader.result as ArrayBuffer);
                const SQL = await window.initSqlJs({
                    locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
                });
                db = new SQL.Database(Uints);
                ensureTablesExist(); // Make sure structure is correct
                saveDatabase();
                resolve();
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

// --- DATA ACCESS METHODS ---

// SETTINGS
export const getSetting = async (key: string): Promise<string | null> => {
    if (!db) await initDatabase();
    const res = db.exec("SELECT value FROM settings WHERE key = ?", [key]);
    if (!res.length) return null;
    return res[0].values[0][0];
};

export const saveSetting = async (key: string, value: string) => {
    if (!db) await initDatabase();
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
    saveDatabase();
};

// MODULES
export const getModules = async (): Promise<ModuleDefinition[]> => {
    if (!db) await initDatabase();
    const res = db.exec("SELECT * FROM modules");
    if (!res.length) return [];
    
    const columns = res[0].columns;
    return res[0].values.map((row: any[]) => ({
        id: row[columns.indexOf('id')],
        label: row[columns.indexOf('label')],
        description: row[columns.indexOf('description')],
        iconName: row[columns.indexOf('iconName')]
    }));
};

export const addModule = async (module: ModuleDefinition) => {
    if (!db) await initDatabase();
    db.run("INSERT INTO modules VALUES (?, ?, ?, ?)", [module.id, module.label, module.description, module.iconName]);
    saveDatabase();
};

export const deleteModule = async (id: string) => {
    if (!db) await initDatabase();
    db.run("DELETE FROM modules WHERE id = ?", [id]);
    saveDatabase();
};


// LICENSES
export const getLicenses = async (): Promise<License[]> => {
  if (!db) await initDatabase();
  const res = db.exec("SELECT * FROM licenses ORDER BY createdAt DESC");
  if (!res.length) return [];
  
  const columns = res[0].columns;
  const values = res[0].values;
  
  return values.map((row: any[]) => {
    const features = JSON.parse(row[columns.indexOf('features')]);
    return {
      id: row[columns.indexOf('id')],
      organization: row[columns.indexOf('organization')],
      contactPerson: row[columns.indexOf('contactPerson')],
      email: row[columns.indexOf('email')],
      phoneNumber: columns.includes('phoneNumber') ? row[columns.indexOf('phoneNumber')] : undefined,
      domain: row[columns.indexOf('domain')],
      key: row[columns.indexOf('key')],
      validUntil: row[columns.indexOf('validUntil')],
      status: row[columns.indexOf('status')],
      features,
      createdAt: row[columns.indexOf('createdAt')]
    } as License;
  });
};

export const createLicense = async (license: License) => {
  if (!db) await initDatabase();
  
  // Ensure we cover the phoneNumber column
  db.run(`INSERT INTO licenses (id, organization, contactPerson, email, domain, key, validUntil, status, features, createdAt, phoneNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    license.id,
    license.organization,
    license.contactPerson,
    license.email,
    license.domain,
    license.key,
    license.validUntil,
    license.status,
    JSON.stringify(license.features),
    license.createdAt,
    license.phoneNumber || null
  ]);
  saveDatabase();
};

export const updateLicenseFeatures = async (id: string, features: FeatureSet) => {
  if (!db) await initDatabase();
  db.run("UPDATE licenses SET features = ? WHERE id = ?", [JSON.stringify(features), id]);
  saveDatabase();
};

export const revokeLicense = async (id: string) => {
  if (!db) await initDatabase();
  db.run("UPDATE licenses SET status = 'suspended' WHERE id = ?", [id]);
  saveDatabase();
};

// REQUESTS
export const getRequests = async (): Promise<LicenseRequest[]> => {
  if (!db) await initDatabase();
  const res = db.exec("SELECT * FROM requests ORDER BY requestDate DESC");
  if (!res.length) return [];

  const columns = res[0].columns;
  return res[0].values.map((row: any[]) => ({
    id: row[columns.indexOf('id')],
    organization: row[columns.indexOf('organization')],
    contactPerson: row[columns.indexOf('contactPerson')],
    email: row[columns.indexOf('email')],
    phoneNumber: columns.includes('phoneNumber') ? row[columns.indexOf('phoneNumber')] : undefined,
    requestedDomain: row[columns.indexOf('requestedDomain')],
    requestDate: row[columns.indexOf('requestDate')],
    note: row[columns.indexOf('note')]
  })) as LicenseRequest[];
};

export const deleteRequest = async (id: string) => {
  if (!db) await initDatabase();
  db.run("DELETE FROM requests WHERE id = ?", [id]);
  saveDatabase();
};

// LOGS
export const getLogs = async (): Promise<ApiLogEntry[]> => {
  if (!db) await initDatabase();
  const res = db.exec("SELECT * FROM logs ORDER BY timestamp ASC"); // Keep chronological for console
  if (!res.length) return [];

  const columns = res[0].columns;
  return res[0].values.map((row: any[]) => ({
    id: row[columns.indexOf('id')],
    timestamp: row[columns.indexOf('timestamp')],
    method: row[columns.indexOf('method')],
    endpoint: row[columns.indexOf('endpoint')],
    sourceUrl: row[columns.indexOf('sourceUrl')],
    providedKey: row[columns.indexOf('providedKey')],
    responseStatus: row[columns.indexOf('responseStatus')],
    responseBody: row[columns.indexOf('responseBody')]
  })) as ApiLogEntry[];
};

export const addLog = async (log: ApiLogEntry) => {
  if (!db) await initDatabase();
  db.run(`INSERT INTO logs VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    log.id,
    log.timestamp,
    log.method,
    log.endpoint,
    log.sourceUrl,
    log.providedKey || '',
    log.responseStatus,
    log.responseBody
  ]);
  saveDatabase();
};

export const findLicenseByKey = async (key: string): Promise<License | null> => {
  if (!db) await initDatabase();
  const res = db.exec("SELECT * FROM licenses WHERE key = ?", [key]);
  if (!res.length) return null;
  
  const row = res[0].values[0];
  const columns = res[0].columns;
  
  return {
    id: row[columns.indexOf('id')],
    organization: row[columns.indexOf('organization')],
    contactPerson: row[columns.indexOf('contactPerson')],
    email: row[columns.indexOf('email')],
    phoneNumber: columns.includes('phoneNumber') ? row[columns.indexOf('phoneNumber')] : undefined,
    domain: row[columns.indexOf('domain')],
    key: row[columns.indexOf('key')],
    validUntil: row[columns.indexOf('validUntil')],
    status: row[columns.indexOf('status')],
    features: JSON.parse(row[columns.indexOf('features')]),
    createdAt: row[columns.indexOf('createdAt')]
  };
};

export const findLicenseByDomain = async (domain: string): Promise<License | null> => {
  if (!db) await initDatabase();
  // Simple case insensitive check
  const res = db.exec("SELECT * FROM licenses WHERE lower(domain) = lower(?)", [domain]);
  if (!res.length) return null;
  
  const row = res[0].values[0];
  const columns = res[0].columns;
  
  return {
    id: row[columns.indexOf('id')],
    organization: row[columns.indexOf('organization')],
    contactPerson: row[columns.indexOf('contactPerson')],
    email: row[columns.indexOf('email')],
    phoneNumber: columns.includes('phoneNumber') ? row[columns.indexOf('phoneNumber')] : undefined,
    domain: row[columns.indexOf('domain')],
    key: row[columns.indexOf('key')],
    validUntil: row[columns.indexOf('validUntil')],
    status: row[columns.indexOf('status')],
    features: JSON.parse(row[columns.indexOf('features')]),
    createdAt: row[columns.indexOf('createdAt')]
  };
};

export const downloadDatabaseFile = async () => {
    if (!db) return;
    const data = db.export();
    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ffw_licenses_${new Date().toISOString().split('T')[0]}.sqlite`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
