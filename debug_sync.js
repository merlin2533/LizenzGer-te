// DEBUG SCRIPT - Manuell im Frontend ausführen
// Öffnen Sie die Browser-Konsole (F12) und fügen Sie diesen Code ein

console.log("=== DEBUG: Checking Database State ===");

// 1. Check localStorage
const localDb = localStorage.getItem('ffw_license_db');
if (localDb) {
    console.log("✓ Browser DB exists in localStorage");
    const dbSize = (localDb.length / 1024).toFixed(2);
    console.log(`  Size: ${dbSize} KB`);
} else {
    console.log("✗ No Browser DB found in localStorage");
}

// 2. Check Settings
async function checkSettings() {
    const { getSetting } = await import('./services/database');

    const apiUrl = await getSetting('apiUrl');
    const secret = await getSetting('adminSecret');

    console.log("\n=== Settings ===");
    console.log("API URL:", apiUrl || "(not set)");
    console.log("Admin Secret:", secret || "(not set)");

    return { apiUrl, secret };
}

// 3. Test API Connection
async function testApiConnection() {
    const { apiUrl, secret } = await checkSettings();

    if (!apiUrl) {
        console.error("⚠️ API URL is not configured!");
        return;
    }

    console.log("\n=== Testing API Connection ===");
    console.log(`Connecting to: ${apiUrl}`);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'sync_admin',
                secret: secret || '123456'
            })
        });

        console.log("Response Status:", response.status);
        console.log("Response Headers:", Object.fromEntries(response.headers.entries()));

        const text = await response.text();
        console.log("Response Body:", text);

        try {
            const data = JSON.parse(text);
            console.log("\n=== Parsed Data ===");
            console.log("Licenses:", data.licenses?.length || 0);
            console.log("Requests:", data.requests?.length || 0);
            console.log("Logs:", data.logs?.length || 0);

            if (data.requests && data.requests.length > 0) {
                console.log("\n=== Requests Details ===");
                data.requests.forEach((req, i) => {
                    console.log(`Request ${i + 1}:`, req);
                });
            }
        } catch (e) {
            console.error("Failed to parse JSON:", e);
        }

    } catch (e) {
        console.error("API Connection Error:", e);
    }
}

// 4. Check Local Database Content
async function checkLocalDatabase() {
    const { getRequests, getLicenses, getLogs } = await import('./services/database');

    console.log("\n=== Local Database Content ===");

    const requests = await getRequests();
    const licenses = await getLicenses();
    const logs = await getLogs();

    console.log("Local Requests:", requests.length);
    console.log("Local Licenses:", licenses.length);
    console.log("Local Logs:", logs.length);

    if (requests.length > 0) {
        console.log("\n=== Local Requests Details ===");
        requests.forEach((req, i) => {
            console.log(`Request ${i + 1}:`, req);
        });
    }
}

// Run all checks
async function runAllChecks() {
    await checkSettings();
    await testApiConnection();
    await checkLocalDatabase();

    console.log("\n=== Next Steps ===");
    console.log("1. If API URL is not set: Go to Settings and configure it");
    console.log("2. If API returns data but local DB is empty: Click 'Server Sync' button");
    console.log("3. If API connection fails: Check your server configuration");
}

runAllChecks().catch(err => console.error("Debug script error:", err));
