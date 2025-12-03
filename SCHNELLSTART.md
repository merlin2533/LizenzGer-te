# 🚀 Schnellstart: Zentrale Datenbank ist jetzt aktiv!

## Was wurde geändert?

**VORHER**: Frontend (Browser-SQLite) ↔️ Sync ↔️ Server (PHP-SQLite)  
**JETZT**: Frontend (API-Client) → Direkt → Server (PHP-SQLite)

✅ Nur noch **eine Datenbank** auf dem Server  
✅ **Keine Synchronisation** mehr nötig  
✅ **Echtzeit-Daten** - immer aktuell  

## 📦 Was Sie jetzt tun müssen:

### 1. Server-Datei aktualisieren

Laden Sie **`index.php`** auf Ihren Webserver hoch:

```
Quelle: c:\Users\Marku\Repos\LiceneTool\LizenzGer-te\index.php
Ziel:   https://lizenz.straub-it.de/index.php  
```

### 2. Frontend starten

```bash
cd c:\Users\Marku\Repos\LiceneTool\LizenzGer-te
npm install   # Falls noch nicht installiert
npm run dev   # Development-Server starten
```

### 3. API-URL konfigurieren

1. Öffnen Sie http://localhost:5173 (oder Ihre Dev-URL)
2. Klicken Sie auf **"Einstellungen"** (Settings-Icon)
3. Tab **"Datenbank & System"**
4. Setzen Sie:
   - **API Endpoint URL**: `https://lizenz.straub-it.de/index.php`
   - **Admin Secret**: `123456`
5. Klicken Sie **"Speichern"**

### 4. Testen Sie es!

1. Klicken Sie auf Tab **"Anfragen"**  
   → Sie sollten die 2 Requests sehen die in der Server-DB sind!

2. Klicken Sie auf **"Freigeben"** bei einer Anfrage  
   → Lizenz wird erstellt und direkt auf dem Server gespeichert

3. Tab **"DB Inspektor"** → Wählen Sie "requests"  
   → Zeigt die Daten direkt vom Server

## ✅ Fertig!

Das war's! Das System läuft jetzt mit **einer zentralen Datenbank**.

**Daten erscheinen jetzt sofort**, weil sie direkt vom Server kommen.  
**Keine "Server Sync" Buttons** mehr nötig.  
**Mehrere Admins können gleichzeitig arbeiten**.

---

## 🔍 Debugging

Falls Anfragen nicht angezeigt werden:

1. **Browser-Konsole öffnen** (F12)
2. **Prüfen Sie die Fehler**:
   - ❌ "API URL not configured" → Gehen Sie zu Einstellungen
   - ❌ "Invalid Secret" → Secret stimmt nicht mit PHP überein
   - ❌ "CORS Error" → Server-Konfiguration prüfen
   - ❌ "fetch failed" → Server offline oder URL falsch

3. **API manuell testen**:
   ```bash
   curl -X POST https://lizenz.straub-it.de/index.php \
     -H "Content-Type: application/json" \
     -d '{"action":"get_requests","secret":"123456"}'
   ```
   
   Sollte zurückgeben:
   ```json
   {
     "status": "ok",
     "data": [...]
   }
   ```

## 📞 Nächste Schritte

1. ✅ Testen Sie das Genehmigen einer Anfrage
2. ✅ Öffnen Sie das Frontend in 2 Browsern → Beide sehen die gleichen Daten
3. ✅ Nach 30 Sekunden aktualisieren sich die Daten automatisch

**Das System ist jetzt viel einfacher und robuster!** 🎉
