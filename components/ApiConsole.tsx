

import React, { useState, useRef, useEffect } from 'react';
import { Send, Globe, Key, Code, ArrowRight, Copy, Server, ServerCog, AlertTriangle, FileJson, Terminal, Download, FileCode, CheckCircle2 } from 'lucide-react';
import { ApiLogEntry } from '../types';

interface ApiConsoleProps {
  onApiRequest: (sourceUrl: string, key?: string) => Promise<ApiLogEntry>;
  logs: ApiLogEntry[];
  apiUrl: string;
}

export const ApiConsole: React.FC<ApiConsoleProps> = ({ onApiRequest, logs, apiUrl }) => {
  const [sourceUrl, setSourceUrl] = useState('feuerwehr-neustadt.de');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'backend'>('console');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onApiRequest(sourceUrl, apiKey);
    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Code in die Zwischenablage kopiert!');
  };

  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Generate Snippets
  const jsFetch = `// NOTE: Funktioniert jetzt direkt hier im Browser!
fetch('${apiUrl}', {
  method: 'POST',
  headers: {
    'Origin': 'https://${sourceUrl}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    key: '${apiKey || ''}' // Leer lassen für Auto-Reg
  })
})
.then(res => res.json())
.then(data => {
  console.log('Server Response:', data);
  if(data.status === 'requested') {
    console.log('Anfrage erstellt. Bitte auf Freischaltung warten.');
  } else if(data.status === 'expired') {
    console.error('LIZENZ ABGELAUFEN am ' + data.validUntil);
  } else if (data.key) {
    console.log('LIZENZ ERHALTEN:', data.key);
    console.log('MODULE:', data.modules);
  }
})
.catch(err => console.error('API Error:', err));`;

  const htaccessCode = `RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]

# CORS Headers (Optional, falls Server dies nicht sendet)
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "POST, GET, OPTIONS"
    Header set Access-Control-Allow-Headers "Content-Type, Origin, X-Auth-Token"
</IfModule>`;

  const phpBackendCode = `<?php
/*
 * SERVER BACKEND IMPLEMENTATION - FFw License Manager
 * 
 * INSTALLATION:
 * 1. Laden Sie diese Datei als 'index.php' auf Ihren Webspace.
 * 2. Stellen Sie sicher, dass der Ordner SCHREIBRECHTE (chmod 775 oder 777) hat.
 * 3. Die Datenbank 'ffw_licenses.sqlite' wird automatisch erstellt.
 */

// KONFIGURATION
$adminSecret = "123456"; // ÄNDERN SIE DIESES PASSWORT IN DER APP!
$dbFile = 'ffw_licenses.sqlite';

// --- HEADERS ---
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Origin, X-Auth-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// --- MODULE DEFINITIONS ---
// Definition der Module für die detaillierte JSON-Antwort
$moduleConfig = [
    'inventory' => [
        'title' => 'Grundinventar', 
        'icon' => 'Server', 
        'desc' => 'Verwaltung von Geräten und Lagerorten'
    ],
    'respiratory' => [
        'title' => 'Atemschutz', 
        'icon' => 'Wind', 
        'desc' => 'Atemschutzwerkstatt & Prüfungen'
    ],
    'hoses' => [
        'title' => 'Schlauchpflege', 
        'icon' => 'Droplet', 
        'desc' => 'Schlauchwäsche & Prüfung'
    ],
    'vehicles' => [
        'title' => 'Fahrtenbuch', 
        'icon' => 'Truck', 
        'desc' => 'Digitales Fahrtenbuch & Tanken'
    ],
    'apiAccess' => [
        'title' => 'API Zugriff', 
        'icon' => 'Database', 
        'desc' => 'Zugriff für externe Systeme'
    ],
    'personnel' => [
        'title' => 'Personal', 
        'icon' => 'Users', 
        'desc' => 'Mannschaftsverwaltung & Lehrgänge'
    ]
];

// --- HELPER ---
function getDb($file) {
    $init = !file_exists($file);
    try {
        $db = new SQLite3($file);
        $db->busyTimeout(5000);
        if ($init) {
            initDb($db);
        }
        // Migrations
        checkMigrations($db);
        return $db;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        exit;
    }
}

function initDb($db) {
    $db->exec("CREATE TABLE IF NOT EXISTS licenses (
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
      phoneNumber TEXT,
      note TEXT
    )");

    $db->exec("CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      organization TEXT,
      contactPerson TEXT,
      email TEXT,
      requestedDomain TEXT,
      requestDate TEXT,
      note TEXT,
      phoneNumber TEXT,
      customMessage TEXT
    )");
}

function checkMigrations($db) {
    // Add columns if they don't exist
    $cols = $db->query("PRAGMA table_info(requests)");
    $hasCustomMessage = false;
    while ($row = $cols->fetchArray()) {
        if ($row['name'] === 'customMessage') $hasCustomMessage = true;
    }
    if (!$hasCustomMessage) {
        $db->exec("ALTER TABLE requests ADD COLUMN customMessage TEXT");
    }
}

function normalizeDomain($url) {
    if (!$url) return 'unknown';
    $url = strtolower(trim($url));
    $url = preg_replace('#^https?://#', '', $url);
    $parts = explode('/', $url);
    $url = $parts[0];
    $parts = explode(':', $url); // Remove port
    return $parts[0];
}

function buildRichModules($featuresJson, $config) {
    $features = json_decode($featuresJson, true);
    if (!is_array($features)) $features = [];
    
    $richList = [];
    
    // Iterate over config to ensure all known modules are listed (or just active ones?)
    // Usually client wants list of capabilities. Let's list all configured ones with status.
    foreach ($config as $key => $def) {
        $isActive = isset($features[$key]) && $features[$key] === true;
        
        $richList[] = [
            'technicalName' => $key,
            'title' => $def['title'],
            'description' => $def['desc'],
            'iconName' => $def['icon'], // For Lucide React mapping
            'iconUrl' => null, // Placeholder if client needs URL
            'active' => $isActive
        ];
    }
    return $richList;
}

// --- MAIN LOGIC ---
$input = json_decode(file_get_contents('php://input'), true);
$db = getDb($dbFile);

// ADMIN ACTIONS
if (isset($input['action'])) {
    // Auth Check
    if (!isset($input['secret']) || $input['secret'] !== $adminSecret) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid Secret']);
        exit;
    }

    if ($input['action'] === 'sync_admin') {
        // PULL: Get all data
        $licenses = [];
        $res = $db->query("SELECT * FROM licenses");
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            $row['features'] = json_decode($row['features'], true);
            $licenses[] = $row;
        }

        $requests = [];
        $res = $db->query("SELECT * FROM requests");
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            $requests[] = $row;
        }

        echo json_encode(['status' => 'ok', 'licenses' => $licenses, 'requests' => $requests]);
        exit;
    }

    if ($input['action'] === 'push_license') {
        // PUSH: Create/Update License
        $lic = $input['license'];
        $stmt = $db->prepare("INSERT OR REPLACE INTO licenses (id, organization, contactPerson, email, domain, key, validUntil, status, features, createdAt, phoneNumber, note) VALUES (:id, :org, :contact, :email, :domain, :key, :valid, :status, :features, :created, :phone, :note)");
        $stmt->bindValue(':id', $lic['id']);
        $stmt->bindValue(':org', $lic['organization']);
        $stmt->bindValue(':contact', $lic['contactPerson']);
        $stmt->bindValue(':email', $lic['email']);
        $stmt->bindValue(':domain', $lic['domain']);
        $stmt->bindValue(':key', $lic['key']);
        $stmt->bindValue(':valid', $lic['validUntil']);
        $stmt->bindValue(':status', $lic['status']);
        $stmt->bindValue(':features', json_encode($lic['features']));
        $stmt->bindValue(':created', $lic['createdAt']);
        $stmt->bindValue(':phone', $lic['phoneNumber'] ?? null);
        $stmt->bindValue(':note', $lic['note'] ?? null);
        $stmt->execute();
        echo json_encode(['status' => 'ok']);
        exit;
    }

    if ($input['action'] === 'delete_request') {
        // PUSH: Delete Request (Approved or Rejected)
        $id = $input['id'];
        $stmt = $db->prepare("DELETE FROM requests WHERE id = :id");
        $stmt->bindValue(':id', $id);
        $stmt->execute();
        echo json_encode(['status' => 'ok']);
        exit;
    }

    if ($input['action'] === 'delete_license') {
        // PUSH: Delete License Permanently
        $id = $input['id'];
        $stmt = $db->prepare("DELETE FROM licenses WHERE id = :id");
        $stmt->bindValue(':id', $id);
        $stmt->execute();
        echo json_encode(['status' => 'ok']);
        exit;
    }

    if ($input['action'] === 'update_request') {
        // PUSH: Update Request (e.g. customMessage)
        $req = $input['request'];
        $stmt = $db->prepare("INSERT OR REPLACE INTO requests (id, organization, contactPerson, email, requestedDomain, requestDate, note, phoneNumber, customMessage) VALUES (:id, :org, :contact, :email, :domain, :date, :note, :phone, :msg)");
        $stmt->bindValue(':id', $req['id']);
        $stmt->bindValue(':org', $req['organization']);
        $stmt->bindValue(':contact', $req['contactPerson']);
        $stmt->bindValue(':email', $req['email']);
        $stmt->bindValue(':domain', $req['requestedDomain']);
        $stmt->bindValue(':date', $req['requestDate']);
        $stmt->bindValue(':note', $req['note'] ?? null);
        $stmt->bindValue(':phone', $req['phoneNumber'] ?? null);
        $stmt->bindValue(':msg', $req['customMessage'] ?? null);
        $stmt->execute();
        echo json_encode(['status' => 'ok']);
        exit;
    }
}

// 2. LICENSE CHECK / REGISTRATION (PUBLIC)
$origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$domain = normalizeDomain($origin);
$providedKey = $input['key'] ?? null;

if (!$providedKey) {
    // AUTO-RECOVERY: Check if we know this domain
    $stmt = $db->prepare("SELECT * FROM licenses WHERE lower(domain) = :domain");
    $stmt->bindValue(':domain', $domain, SQLITE3_TEXT);
    $res = $stmt->execute();
    $license = $res->fetchArray(SQLITE3_ASSOC);

    if ($license) {
        $now = new DateTime();
        $validUntil = new DateTime($license['validUntil']);
        $isExpired = $validUntil < $now;
        $daysRemaining = $now->diff($validUntil)->days;
        if($validUntil < $now) $daysRemaining = 0;

        echo json_encode([
            'status' => $isExpired ? 'expired' : 'active',
            'message' => 'License found via Domain Match.',
            'key' => $license['key'],
            'validUntil' => $license['validUntil'],
            'daysRemaining' => $daysRemaining,
            'modules' => buildRichModules($license['features'], $moduleConfig),
            'features' => $isExpired ? new stdClass() : json_decode($license['features'], true)
        ]);
        exit;
    }

    // Check if pending request exists
    $stmt = $db->prepare("SELECT * FROM requests WHERE lower(requestedDomain) = :domain");
    $stmt->bindValue(':domain', $domain, SQLITE3_TEXT);
    $res = $stmt->execute();
    $req = $res->fetchArray(SQLITE3_ASSOC);

    if ($req) {
        echo json_encode([
            'status' => 'pending', 
            'message' => $req['customMessage'] ? $req['customMessage'] : 'Registrierungsanfrage wartet auf Freigabe.',
            'requestId' => $req['id']
        ]);
    } else {
        // Create Request
        $id = uniqid('req_');
        $date = date('c');
        $stmt = $db->prepare("INSERT INTO requests (id, organization, contactPerson, email, requestedDomain, requestDate, note, customMessage) VALUES (:id, 'Unbekannt', 'Admin', 'admin@' || :domain, :domain, :date, 'Auto-Request', 'Bitte warten...')");
        $stmt->bindValue(':id', $id, SQLITE3_TEXT);
        $stmt->bindValue(':domain', $domain, SQLITE3_TEXT);
        $stmt->bindValue(':date', $date, SQLITE3_TEXT);
        $stmt->execute();

        http_response_code(201);
        echo json_encode([
            'status' => 'requested',
            'message' => 'Anfrage erstellt.',
            'requestId' => $id
        ]);
    }
    exit;
}

// VALIDATE KEY
$stmt = $db->prepare("SELECT * FROM licenses WHERE key = :key");
$stmt->bindValue(':key', $providedKey, SQLITE3_TEXT);
$res = $stmt->execute();
$license = $res->fetchArray(SQLITE3_ASSOC);

if (!$license) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid License Key']);
    exit;
}

if (normalizeDomain($license['domain']) !== $domain) {
    http_response_code(403);
    echo json_encode(['error' => 'Domain Mismatch']);
    exit;
}

if ($license['status'] === 'suspended') {
    http_response_code(403);
    echo json_encode(['error' => 'License Suspended']);
    exit;
}

$now = new DateTime();
$validUntil = new DateTime($license['validUntil']);
$isExpired = $validUntil < $now;
$daysRemaining = $now->diff($validUntil)->days;
if($validUntil < $now) $daysRemaining = 0;

echo json_encode([
    'status' => $isExpired ? 'expired' : 'valid',
    'validUntil' => $license['validUntil'],
    'daysRemaining' => $daysRemaining,
    'modules' => buildRichModules($license['features'], $moduleConfig),
    'features' => $isExpired ? new stdClass() : json_decode($license['features'], true)
]);
?>`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px] overflow-hidden">
      {/* Header Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setActiveTab('console')}
          className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${activeTab === 'console' ? 'bg-white border-b-2 border-red-500 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Terminal size={16} />
          API Simulator Konsole
        </button>
        <button
          onClick={() => setActiveTab('backend')}
          className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${activeTab === 'backend' ? 'bg-white border-b-2 border-red-500 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ServerCog size={16} />
          Backend Deployment
        </button>
      </div>

      {activeTab === 'console' && (
        <div className="flex flex-col h-full">
           {/* Logs Area */}
            <div 
              ref={scrollRef}
              className="flex-1 bg-slate-900 p-4 overflow-y-auto font-mono text-sm space-y-4"
            >
              {logs.length === 0 && (
                <div className="text-slate-500 text-center mt-10">
                  <Terminal size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Warte auf Requests...</p>
                  <p className="text-xs mt-2">Senden Sie eine Anfrage über das Formular unten.</p>
                </div>
              )}
              
              {logs.map((log) => (
                <div key={log.id} className="border-l-2 border-slate-700 pl-3 py-1 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={`px-1.5 rounded text-[10px] font-bold ${log.method === 'POST' ? 'bg-blue-900 text-blue-200' : 'bg-green-900 text-green-200'}`}>
                      {log.method}
                    </span>
                    <span>{log.sourceUrl}</span>
                    <ArrowRight size={10} />
                    <span>{log.endpoint}</span>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="text-slate-300 mb-1">Key: <span className="text-yellow-500">{log.providedKey || '(none)'}</span></p>
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded font-bold ${log.responseStatus === 200 || log.responseStatus === 201 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {log.responseStatus}
                    </div>
                  </div>
                  
                  <div className="mt-2 bg-slate-950 p-2 rounded border border-slate-800 text-slate-300 text-xs overflow-x-auto">
                    <pre>{log.responseBody}</pre>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <form onSubmit={handleSubmit} className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-300 focus-within:ring-2 focus-within:ring-red-500">
                    <Globe size={18} className="text-gray-400" />
                    <input 
                      type="text" 
                      className="flex-1 text-sm outline-none font-mono"
                      placeholder="Origin Domain (z.B. ffw-stadt.de)"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-300 focus-within:ring-2 focus-within:ring-red-500">
                    <Key size={18} className="text-gray-400" />
                    <input 
                      type="text" 
                      className="flex-1 text-sm outline-none font-mono"
                      placeholder="License Key (Optional)"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-slate-900 text-white px-6 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 flex flex-col items-center justify-center gap-1 min-w-[100px]"
                >
                  <Send size={20} />
                  <span className="text-xs">Senden</span>
                </button>
              </form>
            </div>
        </div>
      )}

      {activeTab === 'backend' && (
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
           <div className="max-w-4xl mx-auto space-y-8">
              
              {/* Step 1: Download */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Download size={20} className="text-blue-600" /> 
                      1. Deployment Dateien herunterladen
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">
                      Laden Sie diese Dateien herunter und platzieren Sie sie im Hauptverzeichnis Ihres Webservers.
                  </p>
                  <div className="flex gap-4">
                      <button 
                        onClick={() => downloadFile('index.php', phpBackendCode)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                      >
                          <FileCode size={18} /> index.php herunterladen
                      </button>
                      <button 
                        onClick={() => downloadFile('.htaccess', htaccessCode)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                      >
                          <FileJson size={18} /> .htaccess herunterladen
                      </button>
                  </div>
              </div>

              {/* Step 2: Implementation Info */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                 <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <CheckCircle2 size={20} className="text-green-600" /> 
                      2. Installation & Features
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                          <h4 className="font-bold text-green-900 text-sm mb-1">Automatische Init</h4>
                          <p className="text-xs text-green-800">
                              Beim ersten Aufruf erstellt das Skript automatisch die SQLite Datenbank und alle Tabellen.
                          </p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                          <h4 className="font-bold text-blue-900 text-sm mb-1">Auto-Recovery</h4>
                          <p className="text-xs text-blue-800">
                              Wenn eine Domain bereits registriert ist, wird der Lizenzschlüssel automatisch zurückgegeben.
                          </p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                          <h4 className="font-bold text-purple-900 text-sm mb-1">Admin Sync (2-Wege)</h4>
                          <p className="text-xs text-purple-800">
                              Anfragen werden geladen, Genehmigungen werden direkt auf den Server gepusht.
                          </p>
                      </div>
                       <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                          <h4 className="font-bold text-orange-900 text-sm mb-1">Rich JSON</h4>
                          <p className="text-xs text-orange-800">
                              API gibt jetzt detaillierte Modul-Informationen (Titel, Icons, Status) zurück.
                          </p>
                      </div>
                  </div>
              </div>

              {/* Code Previews */}
              <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2">
                        <FileCode size={16} /> index.php (Vorschau)
                    </h3>
                    <button 
                        onClick={() => copyToClipboard(phpBackendCode)}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                        <Copy size={12} /> Code kopieren
                    </button>
                  </div>
                  <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 overflow-x-auto relative group">
                    <pre className="text-xs font-mono text-slate-300 leading-relaxed">{phpBackendCode}</pre>
                  </div>

                  <div className="flex justify-between items-center pt-4">
                    <h3 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2">
                        <Code size={16} /> Client Integration (JavaScript)
                    </h3>
                    <button 
                        onClick={() => copyToClipboard(jsFetch)}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                        <Copy size={12} /> Code kopieren
                    </button>
                  </div>
                  <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-300 leading-relaxed">{jsFetch}</pre>
                  </div>
              </div>

           </div>
        </div>
      )}
    </div>
  );
};
