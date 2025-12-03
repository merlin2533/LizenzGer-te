import React from 'react';
import { Eye, ServerCog } from 'lucide-react';
import * as DB from '../services/database';

interface SyncTestButtonProps {
    onRefreshData: () => Promise\u003cvoid\u003e;
}

export const SyncTestButton: React.FC\u003cSyncTestButtonProps\u003e = ({ onRefreshData }) => {
    const handleTestSync = async () => {
        const secret = await DB.getSetting('adminSecret') || '123456';
        const url = await DB.getSetting('apiUrl');

        if (!url) {
            alert('❌ Bitte konfigurieren Sie zuerst die API URL im Einstellungsbereich!');
            return;
        }

        try {
            console.log('[SYNC TEST] Connecting to:', url);
            console.log('[SYNC TEST] Using secret:', secret);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sync_admin',
                    secret: secret
                })
            });

            console.log('[SYNC TEST] Response Status:', response.status);
            console.log('[SYNC TEST] Response Headers:', Object.fromEntries(response.headers.entries()));

            const text = await response.text();
            console.log('[SYNC TEST] Response Text:', text);

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                alert(`❌ Server hat kein gültiges JSON zurückgegeben:\n\n${text.substring(0, 200)}`);
                return;
            }

            console.log('[SYNC TEST] Parsed Data:', data);

            if (data.error) {
                alert(`❌ Server-Fehler:\n\n${data.error}\n\nBitte prüfen Sie das Admin Secret (Standard: 123456)`);
            } else {
                // Show detailed data
                let detailsMsg = '✓ Verbindung erfolgreich!\n\n📊 Server-Daten:\n';
                detailsMsg += `• Lizenzen: ${data.licenses?.length || 0}\n`;
                detailsMsg += `• Anfragen: ${data.requests?.length || 0}\n`;
                detailsMsg += `• Logs: ${data.logs?.length || 0}\n\n`;

                if (data.requests && data.requests.length > 0) {
                    detailsMsg += '📋 Gefundene Anfragen:\n';
                    data.requests.forEach((req: any, i: number) => {
                        detailsMsg += `${i + 1}. ${req.organization} (${req.requestedDomain})\n`;
                    });
                    detailsMsg += '\n';
                }

                detailsMsg += '💾 Soll ich diese Daten jetzt in die lokale Browser-Datenbank übernehmen?';

                if (confirm(detailsMsg)) {
                    await DB.mergeExternalData(
                        data.licenses || [],
                        data.requests || [],
                        data.logs || []
                    );
                    await onRefreshData();

                    alert('✅ Daten erfolgreich synchronisiert!\n\nBitte prüfen Sie:\n• Tab "Anfragen" für neue Requests\n• "DB Inspektor" für alle Daten');
                }
            }
        } catch (e: any) {
            console.error('[SYNC TEST] Error:', e);
            alert(`❌ Verbindungsfehler:\n\n${e.message}\n\nMögliche Ursachen:\n- Server offline\n- Falsche URL\n- CORS-Problem`);
        }
    };

    return (
\u003cdiv className =\"bg-gradient-to-br from-green-50 to-blue-50 p-6 rounded-xl border-2 border-green-200 shadow-sm\"\u003e
\u003ch3 className =\"font-bold text-gray-900 mb-3 flex items-center gap-2\"\u003e
\u003cServerCog size = { 20} className =\"text-green-600\" /\u003e
                🔄 Server - Synchronisation Testen
\u003c / h3\u003e
\u003cp className =\"text-sm text-gray-600 mb-4 leading-relaxed\"\u003e
                Klicken Sie hier, um die Verbindung zum PHP - Backend zu testen und die Daten vom Server zu laden.
                Die Server - Datenbank und Browser - Datenbank sind getrennt und müssen manuell synchronisiert werden.
\u003c / p\u003e

\u003cbutton
onClick = { handleTestSync }
className =\"w-full px-5 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg text-sm font-bold hover:from-green-700 hover:to-blue-700 flex items-center justify-center gap-2 shadow-md transition-all transform hover:scale-105\"\u003e
\u003cEye size = { 18} /\u003e
                Jetzt Server - Sync Durchführen
\u003c / button\u003e

\u003cp className =\"text-xs text-gray-500 mt-3 text-center\"\u003e
                💡 Tipp: Öffnen Sie die Browser - Konsole(F12) für detaillierte Debug - Informationen
\u003c / p\u003e
\u003c / div\u003e
    );
};
