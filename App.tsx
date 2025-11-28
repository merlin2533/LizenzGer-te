
import React, { useState, useEffect } from 'react';
import { License, LicenseRequest, FeatureSet, DEFAULT_FEATURES, ApiLogEntry, ModuleDefinition } from './types';
import { LicenseCard } from './components/LicenseCard';
import { RequestModal } from './components/RequestModal';
import { ApiConsole } from './components/ApiConsole';
import { SettingsView } from './components/SettingsView';
import { LayoutDashboard, Inbox, KeyRound, Search, Flame, ServerCog, Activity, Database, Download, Settings } from 'lucide-react';
import * as DB from './services/database';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'settings'>('dashboard');
  const [requests, setRequests] = useState<LicenseRequest[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [modules, setModules] = useState<ModuleDefinition[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LicenseRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [apiUrl, setApiUrl] = useState("https://api.geratewart-manager.de/v1/license/verify");

  // Initialize DB and load data
  useEffect(() => {
    const init = async () => {
      await DB.initDatabase();
      setDbReady(true);
      await refreshData();
    };
    init();
  }, []);

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

  // Simulate API Logic against SQLite
  const handleApiRequest = async (sourceUrl: string, key?: string): Promise<ApiLogEntry> => {
    // Artificial Delay to simulate network
    await new Promise(resolve => setTimeout(resolve, 600));

    let responseStatus: 200 | 201 | 401 | 403 = 200;
    let responseBody: any = {};
    const now = new Date();

    if (!key) {
      // SCENARIO 1: No Key provided -> Auto Registration
      const existingLicense = await DB.findLicenseByDomain(sourceUrl);
      
      if (existingLicense) {
         // Even if requesting without key, if we know the domain, we verify validity
         const validUntilDate = new Date(existingLicense.validUntil);
         const isExpired = validUntilDate < now;
         const daysRemaining = Math.ceil((validUntilDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

         responseStatus = 200;
         responseBody = {
           status: isExpired ? 'expired' : 'active',
           message: isExpired ? 'License expired. Please renew.' : 'License found for this domain.',
           key: existingLicense.key, // In a real scenario, we might obscure this if not authenticated
           validUntil: existingLicense.validUntil,
           daysRemaining: daysRemaining,
           modules: isExpired ? [] : Object.entries(existingLicense.features).filter(([_, v]) => v).map(([k]) => k),
           features: isExpired ? {} : existingLicense.features
         };
      } else {
        // Create new Auto-License
        const newKey = `AUTO-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Date.now().toString().substr(-4)}`;
        const validUntilDate = new Date(new Date().setMonth(new Date().getMonth() + 1)); // 1 Month Trial
        
        const newLicense: License = {
          id: `auto_${Date.now()}`,
          organization: 'Unbekannt (Auto-Registrierung)',
          contactPerson: 'System',
          email: `admin@${sourceUrl}`,
          domain: sourceUrl,
          key: newKey,
          validUntil: validUntilDate.toISOString(), 
          status: 'active',
          features: DEFAULT_FEATURES,
          createdAt: new Date().toISOString()
        };
        
        await DB.createLicense(newLicense);
        responseStatus = 201;
        responseBody = {
          status: 'created',
          message: 'Trial license automatically generated.',
          key: newKey,
          validUntil: newLicense.validUntil,
          daysRemaining: 30,
          modules: Object.entries(newLicense.features).filter(([_, v]) => v).map(([k]) => k),
          features: newLicense.features
        };
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
    // We only need the path if the setting contains the full URL, but here we just simulate endpoint
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
  };

  const handleApprove = async (request: LicenseRequest, features: FeatureSet, validUntil: string, emailContent: string) => {
    const newLicense: License = {
      id: `lic_${Date.now()}`,
      organization: request.organization,
      contactPerson: request.contactPerson,
      email: request.email,
      domain: request.requestedDomain,
      key: `FFW-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      validUntil,
      status: 'active',
      features,
      createdAt: new Date().toISOString()
    };

    await DB.createLicense(newLicense);
    await DB.deleteRequest(request.id);
    
    setSelectedRequest(null);
    setActiveTab('dashboard');
    await refreshData();
  };

  const handleUpdateFeatures = async (id: string, newFeatures: FeatureSet) => {
    await DB.updateLicenseFeatures(id, newFeatures);
    await refreshData();
  };

  const handleRevoke = async (id: string) => {
    if (confirm('Sind Sie sicher, dass Sie diese Lizenz widerrufen möchten?')) {
      await DB.revokeLicense(id);
      await refreshData();
    }
  };

  const filteredLicenses = licenses.filter(l => 
    l.organization.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Lizenz Übersicht</h2>
                <p className="text-gray-500">Verwalten Sie aktive Installationen und Module.</p>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Suche nach Domain, Org..." 
                    className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 w-full md:w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-bold uppercase mb-1">Aktive Lizenzen</div>
                <div className="text-3xl font-bold text-gray-900">{licenses.filter(l => l.status === 'active').length}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-bold uppercase mb-1">Total Requests</div>
                <div className="text-3xl font-bold text-gray-900">{apiLogs.length}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-500 text-xs font-bold uppercase mb-1">Atemschutz Module</div>
                <div className="text-3xl font-bold text-gray-900">{licenses.filter(l => l.features.respiratory).length}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-3 opacity-10">
                  <Database size={48} />
                </div>
                <div className="text-gray-500 text-xs font-bold uppercase mb-1">DB Size</div>
                <div className="text-3xl font-bold text-gray-900">{(apiLogs.length * 0.5 + licenses.length * 1.2 + modules.length * 0.2).toFixed(1)} KB</div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {filteredLicenses.length === 0 ? (
                <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                  Keine Lizenzen gefunden.
                </div>
              ) : (
                filteredLicenses.map(license => (
                  <LicenseCard 
                    key={license.id} 
                    license={license} 
                    onUpdateFeatures={handleUpdateFeatures}
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
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{req.contactPerson} &lt;{req.email}&gt;</p>
                        <div className="text-xs text-gray-500 font-mono bg-gray-100 inline-block px-2 py-1 rounded">
                          {req.requestedDomain}
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
                           Bearbeiten & Freigeben
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
    </div>
  );
}
