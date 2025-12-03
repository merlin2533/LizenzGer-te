# Code-Analyse: Externe Anfragen - Problem und Lösung

## Problem-Beschreibung

Externe Anfragen, die über die `index.php` vom Server kommen, werden nicht sauber verarbeitet und in die Datenbank geschrieben. Die Anfragen sollen im Frontend unter "Anfragen" dargestellt werden, dort gen hmigt werden können, und der Benutzer soll über die API entsprechende Antworten mit den Modulen und dem Lizenzschlüssel erhalten.

## Identifizierte Fehler

### 1. **SQL-String-Konkatenation Fehler** (Zeile 364 alt)

**Problem:**
```php
$stmt = $db->prepare("INSERT INTO requests (..., email, ...) VALUES (:id, 'Unbekannt', 'Admin', 'admin@' || :domain, :domain, ...)");
```

Die SQL-Syntax `'admin@' || :domain` funktioniert NICHT in einem prepared statement.  Der `||` Operator wird nicht ausgewertet, sondern als literaler String behandelt.

**Lösung:**
```php
$email = 'admin@' . $domain; // Email in PHP konstruieren
$stmt = $db->prepare("INSERT INTO requests (..., email, ...) VALUES (:id, :org, :contact, :email, :domain, ...)");
$stmt->bindValue(':email', $email, SQLITE3_TEXT);
```

### 2. **Fehlende Domain-Validierung**

**Problem:**
Wenn `$_SERVER['HTTP_ORIGIN']` und `$_SERVER['HTTP_REFERER']` beide leer sind, wird `$domain = 'unknown'`. Dies führt zu unsinnigen Datenbankeinträgen.

**Lösung:**
```php
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
```

### 3. **Fehlende Fehlerbehandlung beim INSERT**

**Problem:**
Wenn das `INSERT` fehlschlägt (z.B. aus dem oben genannten Grund), wird kein Fehler zurückgegeben.

**Lösung:**
```php
try {
    $stmt = $db->prepare("INSERT INTO requests ...");
    // ... bind values ...
    $result = $stmt->execute();
    
    if (!$result) {
        throw new Exception('Failed to insert request into database');
    }

    $responseStatus = 201;
    http_response_code(201);
    $responseBody = [
        'status' => 'requested',
        'message' => 'Registrierungsanfrage erfolgreich erstellt...',
        'requestId' => $id
    ];
} catch (Exception $e) {
    $responseStatus = 500;
    http_response_code(500);
    $responseBody = [
        'error' => 'Failed to create request: ' . $e->getMessage()
    ];
}
```

### 4. **Alle Felder binden**

**Problem:**
Das originale Statement hat nicht alle Spalten mit Werten gebunden.

**Lösung:**
```php
$stmt = $db->prepare("INSERT INTO requests (id, organization, contactPerson, email, requestedDomain, requestDate, note, phoneNumber, customMessage) VALUES (:id, :org, :contact, :email, :domain, :date, :note, NULL, :msg)");
$stmt->bindValue(':id', $id, SQLITE3_TEXT);
$stmt->bindValue(':org', 'Unbekannt (Auto-Request)', SQLITE3_TEXT);
$stmt->bindValue(':contact', 'System Admin', SQLITE3_TEXT);
$stmt->bindValue(':email', $email, SQLITE3_TEXT);
$stmt->bindValue(':domain', $domain, SQLITE3_TEXT);
$stmt->bindValue(':date', $date, SQLITE3_TEXT);
$stmt->bindValue(':note', 'Automatische Anfrage von Installation', SQLITE3_TEXT);
$stmt->bindValue(':msg', 'Ihre Registrierungsanfrage wird bearbeitet. Bitte warten Sie auf die Freigabe.', SQLITE3_TEXT);
```

## Workflow

### So funktioniert das System:

1. **Externe Anfrage kommt** (Client-Installation):
   - Client sendet POST-Request an `index.php`
   - Kein Lizenzschlüssel vorhanden (`$providedKey` ist null)

2. **Server prüft License-DB**:
   - Gibt es schon eine Lizenz für diese Domain? → Lizenzschlüssel zurückgeben
   - Gibt es schon eine Anfrage für diese Domain? → Status "pending" zurückgeben
   - **NEIN zu beiden** → **NEUE ANFRAGE ERSTELLEN**

3. **Neue Anfrage erstellen**:
   - Domain validieren
   - Request-Eintrag in `requests`-Tabelle erstellen
   - Status 201 + requestId zurückgeben

4. **Frontend (Admin)**:
   - Holt via `sync_admin` alle Requests
   - Zeigt sie unter "Anfragen" an
   - Admin kann genehmigen

5. **Genehmigung**:
   - Erstellt Lizenz-Eintrag
   - Löscht Request-Eintrag
   - Synct beides zum Server

6. **Client holt Lizenz ab**:
   - Sendet erneut Anfrage (ohne Key)
   - Server findet jetzt Lizenz → gibt Modules + Key zurück

## Installation

1. Laden Sie die korrigierte `index_corrected.php` als `index.php` auf Ihren Server hoch
2. Stellen Sie sicher, dass der Ordner Schreibrechte hat (chmod 775 oder 777)
3. Optional: `.htaccess` Datei hochladen für saubere URLs und CORS

## Testing

Nach dem Deployment sollten Sie:

1. **Manuell testen**: HTTP POST an die index.php senden
2. **Frontend prüfen**: Ist die Anfrage im "Anfragen"-Tab sichtbar?
3. **Genehmigen**: Anfrage im Frontend genehmigen
4. **Verifizieren**: Client erhält Lizenzschlüssel und Module

## Zusammenfassung

Die Hauptprobleme waren:
- ❌ SQL-String-Konkatenation in prepared statement (funktioniert nicht)
- ❌ Fehlende Domain-Validierung
- ❌ Keine Fehlerbehandlung

Alle wurden behoben in `index_corrected.php`.
