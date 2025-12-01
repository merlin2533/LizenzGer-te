
import React, { useState, useEffect, useCallback } from 'react';
import { License, LicenseRequest, FeatureSet, DEFAULT_FEATURES, ApiLogEntry, ModuleDefinition } from './types';
import { LicenseCard } from './components/LicenseCard';
import { RequestModal } from './components/RequestModal';
import { CreateLicenseModal } from './components/CreateLicenseModal';
import { ApiConsole } from './components/ApiConsole';
import { SettingsView } from './components/SettingsView';
import { LayoutDashboard, Inbox, KeyRound, Search, Flame, ServerCog, Activity, Database, Download, Settings, Plus, UserPlus, Filter, RefreshCw } from 'lucide-react';
import * as DB from './services/database';
import { ICON_REGISTRY } from './config';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'settings'>('dashboard');
  const [requests, setRequests] = useState<LicenseRequest[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [modules, setModules] = useState<ModuleDefinition[]>([]);
  
  // Modals State
  const [selectedRequest, setSelectedRequest] = useState<LicenseRequest | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired' | 'suspended'>('all');
  
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [apiUrl, setApiUrl] = useState("https://lizenz.straub-it.de/v1/license/verify");
  
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize DB and load data
  useEffect(() => {
    const init = async () => {
      await DB.initDatabase();
      setDbReady(true);
      await refreshData();
    };
    init();
  }, []);

  // Background Sync Interval
  useEffect(() => {
    if (!dbReady) return;

    // Run sync every 30 seconds
    const intervalId = setInterval(() => {
      handleServerSync(true); // silent mode
    }, 30000);

    return () => clearInterval(intervalId);
  }, [dbReady]);

  const refreshData = async () => {
    const lics = await DB.getLicenses();
    const reqs = await DB.getRequests();
    const logs = await DB.getLogs();
    const mods = await DB.getModules();
    const url = await DB.getSetting('apiUrl');
    
    setLicenses(lics);
    setRequests(reqs);
    setApiLogs(logs);
    setModules(mods);
    if (url) setApiUrl(url);
  };

  const handleUpdateApiUrl = async (url: string) => {
      await DB.saveSetting('apiUrl', url);
      setApiUrl(url);
  };

  const handleServerSync = async (silent = false) => {
    const secret = await DB.getSetting('adminSecret');
    const currentUrl = await DB.getSetting('apiUrl');

    if (!secret || !currentUrl) {
        if (!silent) alert("Bitte Admin Secret und API URL in den Einstellungen konfigurieren.");
        return;
    }

    if (!silent) setIsSyncing(true);

    try {
        // Assume the sync endpoint is the same file as the API URL
        const response = await fetch(currentUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'sync_admin', 
                secret: secret 
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Sync Error:", data.error);
            if (!silent) alert("Sync Fehler: " + data.error);
        } else if (data.licenses && data.requests) {
            await DB.mergeExternalData(data.licenses, data.requests);
            await refreshData();
            if (!silent) alert("Synchronisation erfolgreich!");
        }
    } catch (e) {
        console.error("Sync Network Error:", e);
        if (!silent) alert("Verbindungsfehler beim Sync.");
    } finally {
        if (!silent) setIsSyncing(false);
    }
  };

  // Simulate API Logic against SQLite
  const handleApiRequest = useCallback(async (sourceUrl: string, key?: string): Promise<ApiLogEntry> => {
    // Artificial Delay to simulate network (only if direct call)
    // await new Promise(resolve => setTimeout(resolve, 600));

    let responseStatus: 200 | 201 | 401 | 403 = 200;
    let responseBody: any = {};
    const now = new Date();

    if (!key) {
      // SCENARIO 1: No Key provided (Auto Check)
      
      // 1. Check if License exists for this domain
      const existingLicense = await DB.findLicenseByDomain(sourceUrl);
      
      if (existingLicense) {
         // License found! Check validity
         const validUntilDate = new Date(existingLicense.validUntil);
         const isExpired = validUntilDate < now;
         const daysRemaining = Math.ceil((validUntilDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

         responseStatus = 200;
         responseBody = {
           status: isExpired ? 'expired' : 'active',
           message: isExpired ? 'License expired. Please renew.' : 'License found for this domain.',
           key: existingLicense.key, 
           validUntil: existingLicense.validUntil,
           daysRemaining: daysRemaining,
           modules: isExpired ? [] : Object.entries(existingLicense.features).filter(([_, v]) => v).map(([k]) => k),
           features: isExpired ? {} : existingLicense.features
         };
      } else {
        // 2. No License found -> Check if Request exists
        // We use the new helper method directly or find from current state if safer
        // To ensure we are atomic against DB, we use DB calls.
        const existingReq = await DB.findRequestByDomain(sourceUrl);

        if (existingReq) {
             responseStatus = 200; // Success, but pending
             responseBody = {
                 status: 'pending',
                 message: 'Die Registrierungsanfrage für diese Domain wartet auf Freigabe.',
                 requestId: existingReq.id
             };
        } else {
             // 3. No License & No Request -> Create Request AUTOMATICALLY
             const newReq: LicenseRequest = {
                 id: `req_auto_${Date.now()}`,
                 organization: 'Unbekannt (Auto-Request)',
                 contactPerson: 'System Admin',
                 email: `admin@${sourceUrl}`,
                 requestedDomain: sourceUrl,
                 requestDate: new Date().toISOString(),
                 note: 'Automatische Anfrage durch Installation (API)'
             };
             
             await DB.createRequest(newReq);
             
             responseStatus = 201;
             responseBody = {
                 status: 'requested',
                 message: 'Anfrage erfolgreich erstellt. Bitte kontaktieren Sie den Support zur Freischaltung.',
                 requestId: newReq.id
             };
        }
      }

    } else {
      // SCENARIO 2: Key Provided -> Validation
      const license = await DB.findLicenseByKey(key);
      
      if (!license) {
        responseStatus = 403;
        responseBody = { error: 'Invalid License Key' };
      } else if (license.domain.toLowerCase() !== sourceUrl.toLowerCase()) {
        responseStatus = 403;
        responseBody = { error: 'License Key does not match Origin Domain' };
      } else if (license.status === 'suspended') {
        responseStatus = 403;
        responseBody = { error: 'License has been manually suspended.' };
      } else {
        // CHECK EXPIRATION
        const validUntilDate = new Date(license.validUntil);
        const isExpired = validUntilDate < now;
        const daysRemaining = Math.ceil((validUntilDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        responseStatus = 200;

        if (isExpired) {
           responseBody = {
            status: 'expired',
            message: 'Your license has expired. No modules available.',
            validUntil: license.validUntil,
            daysRemaining: daysRemaining,
            modules: [], // Return EMPTY modules
            features: {} // Return EMPTY features
          };
        } else {
          // Valid and Active
          const enabledModules = Object.entries(license.features)
            .filter(([_, enabled]) => enabled)
            .map(([k]) => k);

          responseBody = {
            status: 'valid',
            message: 'License is active.',
            validUntil: license.validUntil,
            daysRemaining: daysRemaining,
            modules: enabledModules,
            features: license.features
          };
        }
      }
    }

    const currentApiUrl = await DB.getSetting('apiUrl') || "/api/v1/license/verify";
    const endpointPath = new URL(currentApiUrl).pathname;

    const newLog: ApiLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      method: 'POST',
      endpoint: endpointPath,
      sourceUrl,
      providedKey: key,
      responseStatus,
      responseBody: JSON.stringify(responseBody, null, 2)
    };

    await DB.addLog(newLog);
    await refreshData();
    return newLog;
  }, []);

  // ------------------------------------------------------------
  // INTERCEPTOR: Monkey Patch window.fetch to simulate backend
  // ------------------------------------------------------------
  useEffect(() => {
    const originalFetch = window.fetch;
    
    // Override fetch
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        
        // Check if the request matches our configured API URL
        // AND make sure it is NOT the sync action (we want Sync to actually hit the network if possible, 
        // OR if this is simulation only, we can't really sync with "self" easily without more logic.
        // For now, let's assume if the user configured a REAL external URL for sync, we let it pass.
        // But if they are just testing locally, the interceptor handles verify/create.
        
        // Logic: Intercept ONLY if logic matches standard verification. 
        // Sync requests have a special body 'action: sync_admin'.
        let isSyncRequest = false;
        if (init?.body) {
            try {
                const b = JSON.parse(init.body as string);
                if (b.action === 'sync_admin') isSyncRequest = true;
            } catch(e) {}
        }

        if (urlStr === apiUrl && init?.method === 'POST' && !isSyncRequest) {
            console.log(`[API SIMULATOR] Intercepting fetch to ${urlStr}`);
            
            try {
                // Parse Body
                let body: any = {};
                if (init.body) {
                    body = JSON.parse(init.body as string);
                }

                // Determine Headers
                const headers = init.headers as Record<string, string>;
                const origin = headers?.['Origin'] || headers?.['origin'] || window.location.hostname;
                
                const result = await handleApiRequest(origin, body.key);

                // Return a fake Response object
                return new Response(result.responseBody, {
                    status: result.responseStatus,
                    statusText: result.responseStatus === 200 ? 'OK' : 'Error',
                    headers: new Headers({
                        'Content-Type': 'application/json',
                        'X-Simulated-By': 'FFw-License-Manager-App'
                    })
                });

            } catch (e) {
                console.error("Simulation Error", e);
                return new Response(JSON.stringify({ error: 'Simulation Failed' }), { status: 500 });
            }
        }

        return originalFetch(input, init);
    };

    return () => {
        // Restore original fetch on cleanup
        window.fetch = originalFetch;
    };
  }, [apiUrl, handleApiRequest]);


  const handleApprove = async (
    request: LicenseRequest, 
    updatedDetails: { organization: string, contactPerson: string, email: string, phoneNumber: string },
    features: FeatureSet, 
    validUntil: string, 
    emailContent: string
  ) => {
    const newLicense: License = {
      id: `lic_${Date.now()}`,
      organization: updatedDetails.organization,
      contactPerson: updatedDetails.contactPerson,
      email: updatedDetails.email,
      phoneNumber: updatedDetails.phoneNumber,
      domain: request.requestedDomain,
      key: `FFW-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      validUntil,
      status: 'active',
      features,
      createdAt: new Date().toISOString(),
      note: request.note // Transfer note from request to license initially
    };

    await DB.createLicense(newLicense);
    await DB.deleteRequest(request.id);
    
    setSelectedRequest(null);
    setActiveTab('dashboard');
    await refreshData();
  };

  const handleManualCreate = async (
    details: { organization: string, contactPerson: string, email: string, phoneNumber: string, domain: string, note: string },
    features: FeatureSet, 
    validUntil: string,
    emailContent: string
  ) => {
    const newLicense: License = {
        id: `lic_man_${Date.now()}`,
        organization: details.organization,
        contactPerson: details.contactPerson,
        email: details.email,
        phoneNumber: details.phoneNumber,
        domain: details.domain,
        key: `FFW-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        validUntil,
        status: 'active',
        features,
        createdAt: new Date().toISOString(),
        note: details.note
    };

    await DB.createLicense(newLicense);
    setShowCreateModal(false);
    setActiveTab('dashboard');
    await refreshData();
  };

  const handleUpdateFeatures = async (id: string, newFeatures: FeatureSet) => {
    await DB.updateLicenseFeatures(id, newFeatures);
    await refreshData();
  };

  const handleUpdateDetails = async (id: string, details: Partial<License>) => {
    await DB.updateLicenseDetails(id, details);
    await refreshData();
  };

  const handleRevoke = async (id: string) => {
    if (confirm('Sind Sie sicher, dass Sie diese Lizenz widerrufen möchten?')) {
      await DB.revokeLicense(id);
      await refreshData();
    }
  };

  const filteredLicenses = licenses.filter(l => {
    const matchesSearch = l.organization.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          l.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          l.domain.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    // Status Filter Logic
    const now = new Date();
    const validUntil = new Date(l.validUntil);
    const isExpired = validUntil < now;

    if (filterStatus === 'all') return true;
    if (filterStatus === 'suspended') return l.status === 'suspended';
    if (filterStatus === 'expired') return isExpired; // Expired regardless of 'active' status flag
    if (filterStatus === 'active') return l.status === 'active' && !isExpired;
    
    return true;
  });

  if (!dbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-mono text-sm">Initializing SQLite Database...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg">
            <Flame className="w-5 h-5 text-white" fill="currentColor" />
          </div>
          <div className="leading-tight">
            <h1 className="font-bold text-lg tracking-tight">Gerätewart</h1>
            <span className="text-xs text-slate-400 font-mono">LIZENZ MANAGER</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard size={18} />
            Übersicht
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'requests' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <div className="relative">
              <Inbox size={18} />
              {requests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-slate-900"></span>
              )}
            </div>
            Anfragen
            {requests.length > 0 && <span className="ml-auto bg-slate-800 text-slate-300 py-0.5 px-2 rounded-full text-xs">{requests.length}</span>}
          </button>

          <div className="pt-4 mt-4 border-t border-slate-800">
             <span className="px-4 text-xs font-bold text-slate-500 uppercase">Verwaltung</span>
             <button 
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 mt-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
             >
                <Settings size={18} />
                Einstellungen
             </button>
             
             <button 
                onClick={() => handleServerSync()}
                disabled={isSyncing}
                className={`w-full flex items-center gap-3 px-4 py-3 mt-2 rounded-lg text-sm font-medium transition-colors text-slate-400 hover:bg-slate-800 hover:text-white group`}
             >
                <RefreshCw size={18} className={`group-hover:text-blue-400 ${isSyncing ? 'animate-spin text-blue-500' : ''}`} />
                {isSyncing ? 'Synchronisiere...' : 'Server Sync'}
             </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400 mb-2">
            <div className="flex justify-between items-center mb-1">
              <p className="font-semibold text-white">System Status</p>
              <Activity size={12} className="text-green-500" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>API & DB Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Lizenz Übersicht</h2>
                <p className="text-gray-500">Verwalten Sie aktive Installationen und Module.</p>
              </div>
              <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
                 <button 
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-sm hover:bg-slate-800 whitespace-nowrap order-1 md:order-3"
                 >
                    <Plus size={16} /> Neue Lizenz
                 </button>
                 
                {/* Status Filter */}
                <div className="relative w-full md:w-48 order-2">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm bg-white appearance-none cursor-pointer hover:bg-gray-50"
                    >
                        <option value="all">Alle Status</option>
                        <option value="active">Nur Aktive</option>
                        <option value="expired">Nur Abgelaufene</option>
                        <option value="suspended">Nur Gesperrte</option>
                    </select>
                </div>

                <div className="relative w-full md:w-64 order-3 md:order-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Suche..." 
                    className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Core Stats */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-bold uppercase mb-1">Aktive Lizenzen</div>
                <div className="text-3xl font-bold text-gray-900">{licenses.filter(l => l.status === 'active').length}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-bold uppercase mb-1">Total Requests</div>
                <div className="text-3xl font-bold text-gray-900">{apiLogs.length}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-3 opacity-10">
                  <Database size={48} />
                </div>
                <div className="text-gray-500 text-xs font-bold uppercase mb-1">DB Size</div>
                <div className="text-3xl font-bold text-gray-900">{(apiLogs.length * 0.5 + licenses.length * 1.2 + modules.length * 0.2).toFixed(1)} KB</div>
              </div>

              {/* Dynamic Module Stats */}
              {modules.map(module => {
                  const Icon = ICON_REGISTRY[module.iconName] || ICON_REGISTRY['Server'];
                  const count = licenses.filter(l => l.features[module.id]).length;
                  return (
                      <div key={module.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center group">
                          <div>
                              <div className="text-gray-500 text-xs font-bold uppercase mb-1 truncate max-w-[120px]" title={module.label}>
                                  {module.label}
                              </div>
                              <div className="text-3xl font-bold text-gray-900">{count}</div>
                          </div>
                          <div className="text-gray-300 bg-gray-50 p-3 rounded-lg group-hover:bg-red-50 group-hover:text-red-500 transition-colors">
                              <Icon size={20} />
                          </div>
                      </div>
                  );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {filteredLicenses.length === 0 ? (
                <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                  {licenses.length === 0 ? "Keine Lizenzen gefunden." : "Keine Lizenzen mit den aktuellen Filtereinstellungen gefunden."}
                </div>
              ) : (
                filteredLicenses.map(license => (
                  <LicenseCard 
                    key={license.id} 
                    license={license} 
                    onUpdateFeatures={handleUpdateFeatures}
                    onUpdateDetails={handleUpdateDetails}
                    onRevoke={handleRevoke}
                    availableModules={modules}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-6">
            <header>
              <h2 className="text-2xl font-bold text-gray-900">Eingegangene Anfragen</h2>
              <p className="text-gray-500">Neue Registrierungen von Feuerwehren validieren.</p>
            </header>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {requests.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <Inbox className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">Alles erledigt!</h3>
                  <p className="text-gray-500">Momentan liegen keine offenen Anfragen vor.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {requests.map((req) => (
                    <div key={req.id} className="p-6 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">{req.organization}</h3>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">Neu</span>
                          {req.id.includes('auto') && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono border border-gray-200">
                                  Auto-Reg
                              </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{req.contactPerson} &lt;{req.email}&gt;</p>
                        <div className="flex items-center gap-2">
                             <div className="text-xs text-gray-500 font-mono bg-gray-100 inline-block px-2 py-1 rounded border border-gray-200">
                                Domain: {req.requestedDomain}
                             </div>
                             <div className="text-[10px] text-gray-400 font-mono">
                                ID: {req.id}
                             </div>
                        </div>
                        {req.note && (
                           <div className="mt-3 text-sm text-gray-600 italic border-l-2 border-blue-200 pl-3">
                             "{req.note}"
                           </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                         <button 
                            onClick={async () => {
                              await DB.deleteRequest(req.id);
                              refreshData();
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg"
                         >
                           Ablehnen
                         </button>
                         <button 
                            onClick={() => setSelectedRequest(req)}
                            className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm shadow-red-200 flex items-center gap-2"
                         >
                           <KeyRound size={16} />
                           Freigeben
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <SettingsView 
            onRefreshData={refreshData} 
            modules={modules}
            apiLogs={apiLogs}
            onApiRequest={handleApiRequest}
            apiUrl={apiUrl}
            onSaveApiUrl={handleUpdateApiUrl}
          />
        )}
      </main>

      {selectedRequest && (
        <RequestModal 
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onApprove={handleApprove}
          availableModules={modules}
        />
      )}

      {showCreateModal && (
          <CreateLicenseModal
            onClose={() => setShowCreateModal(false)}
            onSave={handleManualCreate}
            availableModules={modules}
          />
      )}
    </div>
  );
}
