# LÖSUNG: Server-Daten im Frontend anzeigen

## Problem
Die Daten sind auf dem Server in der `ffw_licenses.sqlite` Datenbank, werden aber im Frontend nicht angezeigt.

## Ursache
Das Frontend verwendet eine **separate Browser-Datenbank** (gespeichert im localStorage), die **NICHT automatisch** mit  der Server-Datenbank synchronisiert wird.

## Lösung

### Methode 1: Manueller Sync (EMPFOHLEN)

1. **Öffnen Sie das Frontend** in Ihrem Browser
2. **Gehen Sie zu "Einstellungen"** (Settings-Tab)
3. **Konfigurieren Sie die API-URL**, z.B.:
   ```
   https://lizenz.straub-it.de/index.php
   ```
4. **Speichern Sie den Admin Secret** (Standard: `123456`)
5. **Klicken Sie auf "Server Sync"** Button in der Sidebar
6. **Warten Sie auf die Bestätigung**
7. **Prüfen Sie den "Anfragen"-Tab** - jetzt sollten die Requests angezeigt werden

### Methode 2: Automatischer Sync (läuft alle 30 Sekunden)

Der Auto-Sync läuft bereits im Hintergrund (`App.tsx` Zeile 42-52), **ABER** nur wenn:
- ✅ Die API URL konfiguriert ist
- ✅ Das Admin Secret korrekt ist
- ✅ Der Server erreichbar ist

### Methode 3: Programmatischer Test mit der Browser-Konsole

1. **Öffnen Sie die Browser-Konsole** (F12)
2. **Führen Sie diesen Code aus**:

```javascript
// Test die Server-Verbindung
const testSync = async () => {
    const url = 'https://lizenz.straub-it.de/index.php'; // Ihre API URL
    const secret = '123456'; // Ihr Admin Secret
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'sync_admin',
                secret: secret
            })
        });
        
        const data = await response.json();
        console.log('Server-Daten:', data);
        
        console.log(`Gefunden: ${data.licenses?.length || 0} Lizenzen`);
        console.log(`Gefunden: ${data.requests?.length || 0} Anfragen`);
        console.log(`Gefunden: ${data.logs?.length || 0} Logs`);
        
        if (data.requests) {
            console.table(data.requests);
        }
        
        return data;
    } catch (e) {
        console.error('Fehler:', e);
    }
};

testSync();
```

3. **Wenn Daten angezeigt werden**, führen Sie aus:

```javascript
// Daten in Browser-DB importieren
const syncData = async () => {
    const { mergeExternalData } = await import('./services/database');
    
    const data = await testSync(); // Erst Daten holen
    
    if (data && data.requests) {
        await mergeExternalData(
            data.licenses || [],
            data.requests || [],
            data.logs || []
        );
        
        console.log('✅ Daten wurden synchronisiert!');
        alert('Daten synchronisiert! Bitte laden Sie die Seite neu (F5)');
    }
};

syncData();
```

### Methode 4: Neue SyncTestButton Komponente nutzen

Die Datei `components/SyncTestButton.tsx` wurde erstellt. Um sie zu nutzen:

1. Öffnen Sie `components/SettingsView.tsx`
2. Fügen Sie am Anfang hinzu:
   ```tsx
   import { SyncTestButton } from './SyncTestButton';
   ```
3. In der `general`-Section (ca. Zeile 176), nach dem "Server Sync Authentifizierung" div, fügen Sie hinzu:
   ```tsx
   \u003cSyncTestButton onRefreshData={onRefreshData} /\u003e
   ```

## Debug-Checklist

✅ **Schritt 1**: Server-Datenbank prüfen
- Öffnen Sie `ffw_licenses.sqlite` mit einem SQLite-Browser
- Bestätigen Sie, dass Daten in der `requests`-Tabelle vorhanden sind

✅ **Schritt 2**: API-URL testen
- Öffnen Sie `https://lizenz.straub-it.de/index.php` im Browser
- Sollte leere Seite oder JSON-Fehler zeigen (ist normal)

✅ **Schritt 3**: Sync-Request senden
```bash
curl -X POST https://lizenz.straub-it.de/index.php \
  -H "Content-Type: application/json" \
  -d '{"action":"sync_admin","secret":"123456"}'
```

Sollte zurückgeben:
```json
{
  "status": "ok",
  "licenses": [...],
  "requests": [...],
  "logs": [...]
}
```

✅ **Schritt 4**: Browser-Datenbank prüfen
- Öffnen Sie Browser-Konsole (F12)
- Führen Sie aus:
```javascript
const { getRequests } = await import('./services/database');
const localRequests = await getRequests();
console.log('Local Requests:', localRequests);
```

## Häufige Probleme

### Problem: "Sync Fehler: Invalid Secret"
**Lösung**: Das Admin Secret stimmt nicht überein
- Im Frontend: Einstellungen → Admin Secret
-  Im PHP-Backend: `index.php` Zeile 17 → `$adminSecret = "123456";`

### Problem: "CORS Error"
**Lösung**: Server sendet keine CORS-Header
- Prüfen Sie `index.php` Zeilen 20-23
- Prüfen Sie `.htaccess` Datei

### Problem: "Daten werden nicht angezeigt"
**Lösung**: Sync wurde nicht durchgeführt
- Klicken Sie manuell auf "Server Sync"
- Oder führen Sie Browser-Konsolen-Code aus
- Oder nutzen Sie die SyncTestButton-Komponente

## Nächste Schritte

1. ✅ Konfigurieren Sie API-URL und Secret
2. ✅ Klicken Sie "Server Sync"
3. ✅ Prüfen Sie "Anfragen"-Tab
4. ✅ Prüfen Sie "DB Inspektor" → "requests"-Tabelle
5. ✅ Genehmigen Sie eine Anfrage
6. ✅ Verifizieren Sie, dass der Client die Lizenz erhält
