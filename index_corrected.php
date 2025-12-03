<?php
/*
 * SERVER BACKEND IMPLEMENTATION - FFw License Manager
 * 
 * INSTALLATION:
 * 1. Laden Sie diese Datei als 'index.php' auf Ihren Webspace.
 * 2. Stellen Sie sicher, dass der Ordner SCHREIBRECHTE (chmod 775 oder 777) hat.
 * 3. Die Datenbank 'ffw_licenses.sqlite' wird automatisch erstellt.
 * 
 * WICHTIGE KORREKTUREN:
 * - SQL String-Konkatenation für E-Mail wurde korrigiert
 * - Domain-Validierung hinzugefügt
 * - Fehlerbehandlung beim Erstellen von Requests verbessert
 */

// KONFIGURATION
$adminSecret = "123456"; // ÄNDERN SIE DIESES PASSWORT IN DER APP!
$dbFile = __DIR__ . '/ffw_licenses.sqlite';

// DEBUGGING
ini_set('display_errors', 0); // Disable HTML errors to not break JSON
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_error.log');

// --- HEADERS ---
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Origin, X-Auth-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// --- MODULE DEFINITIONS ---
$moduleConfig = [
    'inventory' => ['title' => 'Grundinventar', 'icon' => 'Server', 'desc' => 'Verwaltung von Geräten und Lagerorten'],
    'respiratory' => ['title' => 'Atemschutz', 'icon' => 'Wind', 'desc' => 'Atemschutzwerkstatt & Prüfungen'],
    'hoses' => ['title' => 'Schlauchpflege', 'icon' => 'Droplet', 'desc' => 'Schlauchwäsche & Prüfung'],
    'vehicles' => ['title' => 'Fahrtenbuch', 'icon' => 'Truck', 'desc' => 'Digitales Fahrtenbuch & Tanken'],
    'apiAccess' => ['title' => 'API Zugriff', 'icon' => 'Database', 'desc' => 'Zugriff für externe Systeme'],
    'personnel' => ['title' => 'Personal', 'icon' => 'Users', 'desc' => 'Mannschaftsverwaltung & Lehrgänge']
];

// --- HELPER ---

// Polyfill for SQLite3 class using PDO if native extension is missing
if (!defined('SQLITE3_ASSOC')) define('SQLITE3_ASSOC', 1);
if (!defined('SQLITE3_NUM')) define('SQLITE3_NUM', 2);
if (!defined('SQLITE3_BOTH')) define('SQLITE3_BOTH', 3);
if (!defined('SQLITE3_INTEGER')) define('SQLITE3_INTEGER', 1);
if (!defined('SQLITE3_FLOAT')) define('SQLITE3_FLOAT', 2);
if (!defined('SQLITE3_TEXT')) define('SQLITE3_TEXT', 3);
if (!defined('SQLITE3_BLOB')) define('SQLITE3_BLOB', 4);
if (!defined('SQLITE3_NULL')) define('SQLITE3_NULL', 5);

class CompatSQLite3 {
    private $pdo;
    
    public function __construct($filename) {
        if (!class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers())) {
            throw new Exception("SQLite3 extension AND PDO_SQLITE are missing. Please enable one of them.");
        }
        $this->pdo = new PDO('sqlite:' . $filename);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }
    
    public function busyTimeout($msecs) {
        $this->pdo->setAttribute(PDO::ATTR_TIMEOUT, $msecs / 1000);
    }
    
    public function exec($query) {
        return $this->pdo->exec($query);
    }
    
    public function query($query) {
        $stmt = $this->pdo->query($query);
        return new CompatSQLite3Result($stmt);
    }
    
    public function prepare($query) {
        $stmt = $this->pdo->prepare($query);
        return new CompatSQLite3Stmt($stmt);
    }
    
    public function lastErrorMsg() {
        return implode(" ", $this->pdo->errorInfo());
    }
}

class CompatSQLite3Result {
    private $stmt;
    
    public function __construct($stmt) {
        $this->stmt = $stmt;
    }
    
    public function fetchArray($mode = SQLITE3_BOTH) {
        if (!$this->stmt) return false;
        $pdoMode = PDO::FETCH_BOTH;
        if ($mode === SQLITE3_ASSOC) $pdoMode = PDO::FETCH_ASSOC;
        if ($mode === SQLITE3_NUM) $pdoMode = PDO::FETCH_NUM;
        
        return $this->stmt->fetch($pdoMode);
    }
}

class CompatSQLite3Stmt {
    private $stmt;
    
    public function __construct($stmt) {
        $this->stmt = $stmt;
    }
    
    public function bindValue($param, $value, $type = SQLITE3_TEXT) {
        return $this->stmt->bindValue($param, $value);
    }
    
    public function execute() {
        $this->stmt->execute();
        return new CompatSQLite3Result($this->stmt);
    }
}

function getDb($file) {
    $init = !file_exists($file);
    try {
        if (class_exists('SQLite3')) {
            $db = new SQLite3($file);
        } else {
            $db = new CompatSQLite3($file);
        }
        
        $db->busyTimeout(5000);
        if ($init) { initDb($db); }
        checkMigrations($db);
        return $db;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        exit;
    }
}

// ... (previous code)

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

    $db->exec("CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      method TEXT,
      endpoint TEXT,
      sourceUrl TEXT,
      providedKey TEXT,
      responseStatus INTEGER,
      responseBody TEXT
    )");

    $db->exec("CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      label TEXT,
      description TEXT,
      iconName TEXT
    )");
}

function checkMigrations($db) {
    global $moduleConfig;

    $cols = $db->query("PRAGMA table_info(requests)");
    $hasCustomMessage = false;
    while ($row = $cols->fetchArray()) {
        if ($row['name'] === 'customMessage') $hasCustomMessage = true;
    }
    if (!$hasCustomMessage) {
        $db->exec("ALTER TABLE requests ADD COLUMN customMessage TEXT");
    }
    
    // Check for logs table
    $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='logs'");
    if (!$tables->fetchArray()) {
        $db->exec("CREATE TABLE IF NOT EXISTS logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT,
          method TEXT,
          endpoint TEXT,
          sourceUrl TEXT,
          providedKey TEXT,
          responseStatus INTEGER,
          responseBody TEXT
        )");
    }

    // Check for modules table and populate if empty
    $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='modules'");
    if (!$tables->fetchArray()) {
        $db->exec("CREATE TABLE IF NOT EXISTS modules (
          id TEXT PRIMARY KEY,
          label TEXT,
          description TEXT,
          iconName TEXT
        )");
    }

    $res = $db->query("SELECT count(*) as count FROM modules");
    $row = $res->fetchArray(SQLITE3_ASSOC);
    if ($row['count'] == 0) {
        // Populate defaults
        $stmt = $db->prepare("INSERT INTO modules (id, label, description, iconName) VALUES (:id, :label, :desc, :icon)");
        foreach ($moduleConfig as $id => $def) {
            $stmt->bindValue(':id', $id);
            $stmt->bindValue(':label', $def['title']);
            $stmt->bindValue(':desc', $def['desc']);
            $stmt->bindValue(':icon', $def['icon']);
            $stmt->execute();
        }
    }
}

function normalizeDomain($url) {
    if (!$url) return 'unknown';
    $url = strtolower(trim($url));
    $url = preg_replace('#^https?://#', '', $url);
    $parts = explode('/', $url);
    $url = $parts[0];
    $parts = explode(':', $url); 
    return $parts[0];
}

function getModuleConfigFromDb($db) {
    $config = [];
    try {
        $res = $db->query("SELECT * FROM modules");
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            $config[$row['id']] = [
                'title' => $row['label'],
                'desc' => $row['description'],
                'icon' => $row['iconName']
            ];
        }
    } catch (Exception $e) {
        // Fallback if table doesn't exist yet or error
        global $moduleConfig;
        return $moduleConfig;
    }
    return $config;
}

function buildRichModules($featuresJson, $config) {
    $features = json_decode($featuresJson, true);
    if (!is_array($features)) $features = [];
    $richList = [];
    foreach ($config as $key => $def) {
        $isActive = isset($features[$key]) && $features[$key] === true;
        $richList[] = [
            'technicalName' => $key,
            'title' => $def['title'],
            'description' => $def['desc'],
            'iconName' => $def['icon'], 
            'active' => $isActive
        ];
    }
    return $richList;
}

function logAccess($db, $sourceUrl, $key, $status, $body) {
    try {
        $id = uniqid('log_');
        $time = date('c');
        $stmt = $db->prepare("INSERT INTO logs VALUES (:id, :time, 'POST', 'api.php', :source, :key, :status, :body)");
        $stmt->bindValue(':id', $id);
        $stmt->bindValue(':time', $time);
        $stmt->bindValue(':source', $sourceUrl);
        $stmt->bindValue(':key', $key ?? '');
        $stmt->bindValue(':status', $status);
        $stmt->bindValue(':body', is_string($body) ? $body : json_encode($body));
        $stmt->execute();
    } catch(Exception $e) { /* ignore log errors */ }
}

// --- MAIN LOGIC ---
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

// Health Check / Debug
if (isset($_GET['health'])) {
    header('Content-Type: application/json');
    
    $dirWritable = is_writable(__DIR__);
    $dbExists = file_exists($dbFile);
    $dbWritable = $dbExists ? is_writable($dbFile) : $dirWritable;
    
    echo json_encode([
        'status' => 'ok', 
        'message' => 'Server is reachable', 
        'sqlite3' => class_exists('SQLite3'), 
        'pdo_sqlite' => class_exists('PDO') && in_array('sqlite', PDO::getAvailableDrivers()),
        'php_version' => phpversion(),
        'db_path' => $dbFile,
        'db_exists' => $dbExists,
        'dir_writable' => $dirWritable,
        'db_writable' => $dbWritable
    ]);
    exit;
}

$db = getDb($dbFile);

// ADMIN ACTIONS (Authentication required)
if (is_array($input) && isset($input['action'])) {
    if (!isset($input['secret']) || $input['secret'] !== $adminSecret) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid Secret']);
        exit;
    }

    // === GET OPERATIONS ===
    
    if ($input['action'] === 'get_requests') {
        $requests = [];
        $res = $db->query("SELECT * FROM requests ORDER BY requestDate DESC");
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            $requests[] = $row;
        }
        echo json_encode(['status' => 'ok', 'data' => $requests]);
        exit;
    }
    
    if ($input['action'] === 'get_licenses') {
        $licenses = [];
        $res = $db->query("SELECT * FROM licenses ORDER BY createdAt DESC");
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            $row['features'] = json_decode($row['features'], true);
            $licenses[] = $row;
        }
        echo json_encode(['status' => 'ok', 'data' => $licenses]);
        exit;
    }
    
    if ($input['action'] === 'get_logs') {
        $logs = [];
        $res = $db->query("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100");
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            $logs[] = $row;
        }
        echo json_encode(['status' => 'ok', 'data' => $logs]);
        exit;
    }
    
    if ($input['action'] === 'get_modules') {
        $modules = [];
        $res = $db->query("SELECT * FROM modules");
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            $modules[] = $row;
        }
        echo json_encode(['status' => 'ok', 'data' => $modules]);
        exit;
    }

    // === CREATE OPERATIONS ===
    
    if ($input['action'] === 'create_license') {
        $lic = $input['license'];
        $stmt = $db->prepare("INSERT INTO licenses (id, organization, contactPerson, email, domain, key, validUntil, status, features, createdAt, phoneNumber, note) VALUES (:id, :org, :contact, :email, :domain, :key, :valid, :status, :features, :created, :phone, :note)");
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

    if ($input['action'] === 'add_module') {
        $mod = $input['module'];
        // Check if exists
        $stmt = $db->prepare("SELECT id FROM modules WHERE id = :id");
        $stmt->bindValue(':id', $mod['id']);
        $res = $stmt->execute();
        if ($res->fetchArray()) {
            http_response_code(400);
            echo json_encode(['error' => 'Module ID already exists']);
            exit;
        }

        $stmt = $db->prepare("INSERT INTO modules (id, label, description, iconName) VALUES (:id, :label, :desc, :icon)");
        $stmt->bindValue(':id', $mod['id']);
        $stmt->bindValue(':label', $mod['label']);
        $stmt->bindValue(':desc', $mod['description']);
        $stmt->bindValue(':icon', $mod['iconName']);
        $stmt->execute();
        echo json_encode(['status' => 'ok']);
        exit;
    }
    
    // === UPDATE OPERATIONS ===
    
    if ($input['action'] === 'update_license') {
        $lic = $input['license'];
        $stmt = $db->prepare("UPDATE licenses SET organization = :org, contactPerson = :contact, email = :email, domain = :domain, key = :key, validUntil = :valid, status = :status, features = :features, phoneNumber = :phone, note = :note WHERE id = :id");
        $stmt->bindValue(':org', $lic['organization']);
        $stmt->bindValue(':contact', $lic['contactPerson']);
        $stmt->bindValue(':email', $lic['email']);
        $stmt->bindValue(':domain', $lic['domain']);
        $stmt->bindValue(':key', $lic['key']);
        $stmt->bindValue(':valid', $lic['validUntil']);
        $stmt->bindValue(':status', $lic['status']);
        $stmt->bindValue(':features', json_encode($lic['features']));
        $stmt->bindValue(':phone', $lic['phoneNumber'] ?? null);
        $stmt->bindValue(':note', $lic['note'] ?? null);
        $stmt->bindValue(':id', $lic['id']);
        $stmt->execute();
        echo json_encode(['status' => 'ok']);
        exit;
    }
    
    if ($input['action'] === 'update_license_features') {
        $id = $input['id'];
        $features = $input['features'];
        $stmt = $db->prepare("UPDATE licenses SET features = :features WHERE id = :id");
        $stmt->bindValue(':features', json_encode($features));
        $stmt->bindValue(':id', $id);
        $stmt->execute();
        echo json_encode(['status' => 'ok']);
        exit;
    }
    
    if ($input['action'] === 'revoke_license') {
        $id = $input['id'];
        $stmt = $db->prepare("UPDATE licenses SET status = 'suspended' WHERE id = :id");
        $stmt->bindValue(':id', $id);
        $stmt->execute();
        echo json_encode(['status' => 'ok']);
        exit;
    }

    if ($input['action'] === 'update_request') {
        $req = $input['request'];
        $stmt = $db->prepare("UPDATE requests SET organization = :org, contactPerson = :contact, email = :email, phoneNumber = :phone, note = :note, customMessage = :msg WHERE id = :id");
        $stmt->bindValue(':org', $req['organization']);
        $stmt->bindValue(':contact', $req['contactPerson']);
        $stmt->bindValue(':email', $req['email']);
        $stmt->bindValue(':phone', $req['phoneNumber'] ?? null);
        $stmt->bindValue(':note', $req['note'] ?? null);
        $stmt->bindValue(':msg', $req['customMessage'] ?? null);
        $stmt->bindValue(':id', $req['id']);
        $stmt->execute();
        echo json_encode(['status' => 'ok']);
        exit;
    }
    
    // === DELETE OPERATIONS ===
    
    if ($input['action'] === 'delete_request') {
        $id = $input['id'];
        $stmt = $db->prepare("DELETE FROM requests WHERE id = :id");
        $stmt->bindValue(':id', $id);
        $stmt->execute();
        echo json_encode(['status' => 'ok']);
        exit;
    }
    
    if ($input['action'] === 'delete_license') {
        $id = $input['id'];
        $stmt = $db->prepare("DELETE FROM licenses WHERE id = :id");
        $stmt->bindValue(':id', $id);
        $stmt->execute();
        echo json_encode(['status' => 'ok']);
        exit;
    }

    if ($input['action'] === 'delete_module') {
        $id = $input['id'];
        $stmt = $db->prepare("DELETE FROM modules WHERE id = :id");
        $stmt->bindValue(':id', $id);
        $stmt->execute();
        echo json_encode(['status' => 'ok']);
        exit;
    }
    
    // === SETTINGS ===
    
    if ($input['action'] === 'get_setting') {
        // For now, return empty - settings can be stored in a separate table if needed
        echo json_encode(['status' => 'ok', 'value' => null]);
        exit;
    }
    
    if ($input['action'] === 'save_setting') {
        // For now, just acknowledge - can be implemented later if needed
        echo json_encode(['status' => 'ok']);
        exit;
    }

    // === LEGACY SYNC (for backward compatibility) ===
    
    if ($input['action'] === 'sync_admin') {
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
        
        $logs = [];
        $res = $db->query("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 50");
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            $logs[] = $row;
        }

        echo json_encode([
            'status' => 'ok', 
            'licenses' => $licenses, 
            'requests' => $requests,
            'logs' => $logs
        ]);
        exit;
    }
    }


// 2. PUBLIC API
$origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$domain = normalizeDomain($origin);
$providedKey = $input['key'] ?? null;

// Load dynamic module config
$currentModuleConfig = getModuleConfigFromDb($db);

// RESPONSE DATA
$responseStatus = 200;
$responseBody = [];

if (!$providedKey) {
    // AUTO-RECOVERY
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

        $responseBody = [
            'status' => $isExpired ? 'expired' : 'active',
            'message' => 'License found via Domain Match.',
            'key' => $license['key'],
            'validUntil' => $license['validUntil'],
            'daysRemaining' => $daysRemaining,
            'modules' => buildRichModules($license['features'], $currentModuleConfig),
            'features' => $isExpired ? new stdClass() : json_decode($license['features'], true)
        ];
    } else {
        // PENDING REQUEST
        $stmt = $db->prepare("SELECT * FROM requests WHERE lower(requestedDomain) = :domain");
        $stmt->bindValue(':domain', $domain, SQLITE3_TEXT);
        $res = $stmt->execute();
        $req = $res->fetchArray(SQLITE3_ASSOC);

        if ($req) {
            $responseBody = [
                'status' => 'pending', 
                'message' => $req['customMessage'] ? $req['customMessage'] : 'Registrierungsanfrage wartet auf Freigabe.',
                'requestId' => $req['id']
            ];
        } else {
            // CREATE REQUEST
            // Validate domain
            if (empty($domain) || $domain === 'unknown') {
                $responseStatus = 400;
                http_response_code(400);
                $responseBody = [
                    'error' => 'Invalid domain. Please ensure your request includes a valid Origin or Referer header.'
                ];
                logAccess($db, $domain, $providedKey, $responseStatus, $responseBody);
                echo json_encode($responseBody);
                exit;
            }
            
            $id = uniqid('req_');
            $date = date('c');
            $email = 'admin@' . $domain; // Construct email in PHP, not SQL
            
            try {
                $stmt = $db->prepare("INSERT INTO requests (id, organization, contactPerson, email, requestedDomain, requestDate, note, phoneNumber, customMessage) VALUES (:id, :org, :contact, :email, :domain, :date, :note, NULL, :msg)");
                $stmt->bindValue(':id', $id, SQLITE3_TEXT);
                $stmt->bindValue(':org', 'Unbekannt (Auto-Request)', SQLITE3_TEXT);
                $stmt->bindValue(':contact', 'System Admin', SQLITE3_TEXT);
                $stmt->bindValue(':email', $email, SQLITE3_TEXT);
                $stmt->bindValue(':domain', $domain, SQLITE3_TEXT);
                $stmt->bindValue(':date', $date, SQLITE3_TEXT);
                $stmt->bindValue(':note', 'Automatische Anfrage von Installation', SQLITE3_TEXT);
                $stmt->bindValue(':msg', 'Ihre Registrierungsanfrage wird bearbeitet. Bitte warten Sie auf die Freigabe.', SQLITE3_TEXT);
                $result = $stmt->execute();
                
                if (!$result) {
                    throw new Exception('Failed to insert request into database');
                }

                $responseStatus = 201;
                http_response_code(201);
                $responseBody = [
                    'status' => 'requested',
                    'message' => 'Registrierungsanfrage erfolgreich erstellt. Wir werden Ihre Anfrage prüfen und uns bei Ihnen melden.',
                    'requestId' => $id
                ];
            } catch (Exception $e) {
                $responseStatus = 500;
                http_response_code(500);
                $responseBody = [
                    'error' => 'Failed to create request: ' . $e->getMessage()
                ];
            }
        }
    }
} else {
    // VALIDATE KEY
    $stmt = $db->prepare("SELECT * FROM licenses WHERE key = :key");
    $stmt->bindValue(':key', $providedKey, SQLITE3_TEXT);
    $res = $stmt->execute();
    $license = $res->fetchArray(SQLITE3_ASSOC);

    if (!$license) {
        $responseStatus = 403;
        http_response_code(403);
        $responseBody = ['error' => 'Invalid License Key'];
    } elseif (normalizeDomain($license['domain']) !== $domain) {
        $responseStatus = 403;
        http_response_code(403);
        $responseBody = ['error' => 'Domain Mismatch'];
    } elseif ($license['status'] === 'suspended') {
        $responseStatus = 403;
        http_response_code(403);
        $responseBody = ['error' => 'License Suspended'];
    } else {
        $now = new DateTime();
        $validUntil = new DateTime($license['validUntil']);
        $isExpired = $validUntil < $now;
        $daysRemaining = $now->diff($validUntil)->days;
        if($validUntil < $now) $daysRemaining = 0;

        $responseBody = [
            'status' => $isExpired ? 'expired' : 'valid',
            'validUntil' => $license['validUntil'],
            'daysRemaining' => $daysRemaining,
            'modules' => buildRichModules($license['features'], $currentModuleConfig),
            'features' => $isExpired ? new stdClass() : json_decode($license['features'], true)
        ];
    }
}

// LOGGING
logAccess($db, $domain, $providedKey, $responseStatus, $responseBody);

echo json_encode($responseBody);
?>
