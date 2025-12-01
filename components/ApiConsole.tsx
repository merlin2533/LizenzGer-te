
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
 * 3. Die Datenbank 'ffw_licenses.sqlite' wird beim ersten Aufruf automatisch erstellt.
 */

// Fehleranzeige für Debugging (in Produktion ausschalten)
ini_set('display_errors', 0);
error_reporting(E_ALL);

// CORS Headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Sicherheit: Hier später die App-Domain eintragen
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Origin');

// Preflight Request behandeln
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 1. Request Body lesen
$input = json_decode(file_get_contents('php://input'), true);
$headers = getallheaders();
$origin = $headers['Origin'] ?? $_SERVER['HTTP_ORIGIN'] ?? 'unknown';

// Origin aus Header bereinigen (https:// entfernen) für DB-Abgleich
$domain = parse_url($origin, PHP_URL_HOST) ?: $origin;

$key = $input['key'] ?? null;
$dbFile = 'ffw_licenses.sqlite';

try {
    // Prüfen ob DB existiert, sonst erstellen (INIT)
    $db = new SQLite3($dbFile);
    
    // Auto-Init: Tabellenstruktur erstellen, wenn sie noch nicht existiert
    $db->exec("
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
          phoneNumber TEXT,
          note TEXT
        );
    ");

    $db->exec("
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
    ");

    $now = new DateTime();
    
    if (!$key) {
        // --- SCENARIO 1: AUTO REGISTRATION / CHECK (Kein Key angegeben) ---
        
        // A) Prüfe, ob es bereits eine aktive Lizenz gibt (Recovery)
        $stmt = $db->prepare('SELECT * FROM licenses WHERE lower(domain) = lower(:dom)');
        $stmt->bindValue(':dom', $domain, SQLITE3_TEXT);
        $res = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        
        if ($res) {
             // Lizenz existiert -> Rückgabe (wie beim Verify)
             $validUntil = new DateTime($res['validUntil']);
             $expired = $validUntil < $now;
             $features = json_decode($res['features'], true);
             
             echo json_encode([
                 'status' => $expired ? 'expired' : 'active',
                 'key' => $res['key'],
                 'validUntil' => $res['validUntil'],
                 'modules' => $expired ? [] : array_keys(array_filter($features ?: [])),
                 'features' => $expired ? new stdClass() : $features,
                 'message' => 'Lizenz gefunden.'
             ]);
        } else {
             // B) Keine Lizenz -> Prüfe auf offene Anfrage
             $stmtReq = $db->prepare('SELECT * FROM requests WHERE lower(requestedDomain) = lower(:dom)');
             $stmtReq->bindValue(':dom', $domain, SQLITE3_TEXT);
             $req = $stmtReq->execute()->fetchArray(SQLITE3_ASSOC);
             
             if ($req) {
                 // Anfrage läuft bereits
                 echo json_encode([
                    'status' => 'pending', 
                    'message' => 'Registrierungsanfrage wartet auf Freigabe.',
                    'requestId' => $req['id']
                 ]);
             } else {
                 // C) Gar nichts gefunden -> Neue Anfrage erstellen
                 $newId = uniqid('req_');
                 $stmtIns = $db->prepare("INSERT INTO requests (id, organization, contactPerson, email, requestedDomain, requestDate, note) VALUES (:id, 'Unbekannt', 'System', :email, :dom, :date, 'Auto-Request via API')");
                 
                 $stmtIns->bindValue(':id', $newId, SQLITE3_TEXT);
                 $stmtIns->bindValue(':email', 'admin@' . $domain, SQLITE3_TEXT);
                 $stmtIns->bindValue(':dom', $domain, SQLITE3_TEXT);
                 $stmtIns->bindValue(':date', $now->format('c'), SQLITE3_TEXT);
                 
                 $stmtIns->execute();
                 
                 http_response_code(201);
                 echo json_encode([
                    'status' => 'requested', 
                    'message' => 'Anfrage erfolgreich erstellt. Bitte warten Sie auf Freischaltung.',
                    'requestId' => $newId
                 ]);
             }
        }
    } else {
        // --- SCENARIO 2: VERIFICATION (Key angegeben) ---
        $stmt = $db->prepare('SELECT * FROM licenses WHERE key = :key');
        $stmt->bindValue(':key', $key, SQLITE3_TEXT);
        $res = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        
        if (!$res) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid License Key']);
        } else {
            // Optional: Strict Domain Check (Empfohlen)
            // if (strtolower($res['domain']) !== strtolower($domain)) { ... }
             
            $validUntil = new DateTime($res['validUntil']);
            $expired = $validUntil < $now;
            $features = json_decode($res['features'], true);
            
            echo json_encode([
                'status' => $expired ? 'expired' : 'active',
                'validUntil' => $res['validUntil'],
                'modules' => $expired ? [] : array_keys(array_filter($features ?: [])),
                'features' => $expired ? new stdClass() : $features
            ]);
        }
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database Error: ' . $e->getMessage()]);
}
?>`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
      
      {/* Left Column: Input & Documentation */}
      <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pr-1">
        
        {/* Toggle Tabs */}
        <div className="flex bg-gray-200 rounded-lg p-1">
            <button 
                onClick={() => setActiveTab('console')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'console' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Simulator & Client
            </button>
            <button 
                onClick={() => setActiveTab('backend')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'backend' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Server Backend
            </button>
        </div>

        {activeTab === 'console' ? (
            <>
                {/* Simulator Form */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Code className="w-5 h-5 text-red-600" />
                    API Test Console
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                    Senden Sie Requests an die simulierte Backend-API.
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Source URL (Origin)</label>
                    <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input 
                        type="text" 
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                        placeholder="z.B. ffw-dorf.de"
                        required
                        />
                    </div>
                    </div>

                    <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                        Lizenzschlüssel (Optional)
                    </label>
                    <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input 
                        type="text" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none font-mono"
                        placeholder="Leer lassen für Erstregistrierung"
                        />
                    </div>
                    </div>

                    <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-slate-800 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                    {loading ? 'Sende Request...' : (
                        <>
                        Request senden <Send size={14} />
                        </>
                    )}
                    </button>
                </form>
                </div>

                {/* Integration Guide */}
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                        <Terminal className="w-4 h-4 text-slate-700" />
                        <h3 className="text-sm font-bold text-slate-800 uppercase">JavaScript Client</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 mb-2">
                           <p className="text-[10px] text-yellow-800">
                             Hinweis: Der folgende Code funktioniert in Ihrem Browser, da die App Requests an <strong>{apiUrl}</strong> abfängt und simuliert.
                           </p>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">fetch() Example</label>
                            <button onClick={() => copyToClipboard(jsFetch)} className="text-slate-400 hover:text-slate-600"><Copy size={12} /></button>
                            </div>
                            <pre className="bg-slate-800 text-blue-300 p-2 rounded text-[10px] overflow-x-auto whitespace-pre-wrap font-mono">
                            {jsFetch}
                            </pre>
                        </div>
                    </div>
                </div>
            </>
        ) : (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                     <ServerCog className="w-5 h-5 text-purple-600" />
                     <h3 className="text-lg font-bold text-gray-900">Backend Deployment</h3>
                </div>

                <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
                     <div className="flex items-center gap-2 text-green-800 font-bold text-sm mb-2">
                        <CheckCircle2 size={16} />
                        <span>Logik Update: Auto-Init & Auto-Request</span>
                     </div>
                     <p className="text-xs text-green-700 leading-relaxed mb-3">
                        Das Skript erstellt die Datenbank <code>ffw_licenses.sqlite</code> automatisch, wenn sie noch nicht existiert. 
                        Unbekannte Domains lösen keine Fehler mehr aus, sondern erstellen eine "Anfrage", die Sie in dieser App freigeben können.
                     </p>
                     
                     <div className="flex gap-2">
                        <button 
                          onClick={() => downloadFile('index.php', phpBackendCode)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-bold rounded shadow-sm hover:bg-green-700 transition-colors"
                        >
                           <Download size={12} /> index.php
                        </button>
                        <button 
                          onClick={() => downloadFile('.htaccess', htaccessCode)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 border border-gray-300 text-xs font-bold rounded shadow-sm hover:bg-gray-50 transition-colors"
                        >
                           <FileCode size={12} /> .htaccess
                        </button>
                     </div>
                     <p className="text-[10px] text-green-800 mt-2 opacity-75">
                        Dateien herunterladen und auf den Server hochladen. Ordner-Schreibrechte beachten!
                     </p>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">php / index.php Preview</label>
                        <button onClick={() => copyToClipboard(phpBackendCode)} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-[10px]">
                            <Copy size={10} /> Kopieren
                        </button>
                    </div>
                    <div className="relative flex-1 bg-slate-800 rounded overflow-hidden">
                        <pre className="absolute inset-0 p-3 text-purple-300 text-[10px] overflow-auto whitespace-pre font-mono">
                            {phpBackendCode}
                        </pre>
                    </div>
                </div>
            </div>
        )}

      </div>

      {/* Right Column: Log Output */}
      <div className="lg:col-span-2 bg-slate-900 rounded-xl shadow-lg border border-slate-800 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
          <span className="text-xs font-mono text-slate-400">SERVER LOGS (SQLite)</span>
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm">
          {logs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
              <ServerCog size={32} className="opacity-50" />
              <p>Warte auf eingehende Requests...</p>
            </div>
          )}
          
          {logs.map((log) => (
            <div key={log.id} className="animate-fade-in group">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                <ArrowRight size={10} />
                <span className="text-blue-400">{log.method} {log.endpoint}</span>
              </div>
              
              <div className={`bg-slate-950 rounded border p-3 transition-colors ${log.responseStatus === 200 || log.responseStatus === 201 ? 'border-slate-800' : 'border-red-900/50 bg-red-950/10'}`}>
                <div className="flex justify-between items-start mb-2 border-b border-slate-900 pb-2">
                   <div>
                     <span className="text-slate-400 text-xs block">Origin:</span>
                     <span className="text-green-400">{log.sourceUrl}</span>
                   </div>
                   {log.providedKey ? (
                     <div className="text-right">
                       <span className="text-slate-400 text-xs block">Key:</span>
                       <span className="text-yellow-500 text-xs">{log.providedKey}</span>
                     </div>
                   ) : (
                      <div className="text-right">
                        <span className="text-slate-500 text-xs italic block">Auto-Check</span>
                      </div>
                   )}
                </div>

                <div>
                  <span className="text-slate-400 text-xs block mb-1">
                    Response ({log.responseStatus}) 
                    {log.responseStatus === 403 && <span className="text-red-500 ml-2 font-bold">BLOCKED</span>}
                  </span>
                  <pre className={`text-xs overflow-x-auto ${log.responseStatus === 200 || log.responseStatus === 201 ? 'text-slate-300' : 'text-red-400'}`}>
                    {log.responseBody}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
