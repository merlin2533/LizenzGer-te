
import React, { useState, useEffect } from 'react';
import { Upload, Download, Database, Plus, Trash2, ServerCog, HardDrive, LayoutGrid, Globe, ScrollText, Lock } from 'lucide-react';
import { ModuleDefinition, ApiLogEntry } from '../types';
import { ICON_REGISTRY } from '../config';
import { ApiConsole } from './ApiConsole';
import * as DB from '../services/database';

interface SettingsViewProps {
  onRefreshData: () => Promise<void>;
  modules: ModuleDefinition[];
  apiLogs: ApiLogEntry[];
  onApiRequest: (sourceUrl: string, key?: string) => Promise<ApiLogEntry>;
  apiUrl: string;
  onSaveApiUrl: (url: string) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onRefreshData, modules, apiLogs, onApiRequest, apiUrl, onSaveApiUrl }) => {
  const [activeSection, setActiveSection] = useState<'general' | 'modules' | 'api' | 'logs'>('general');
  const [newModule, setNewModule] = useState<ModuleDefinition>({
    id: '',
    label: '',
    description: '',
    iconName: 'Server'
  });
  const [localApiUrl, setLocalApiUrl] = useState(apiUrl);
  const [adminSecret, setAdminSecret] = useState('');

  useEffect(() => {
    setLocalApiUrl(apiUrl);
    DB.getSetting('adminSecret').then(val => {
        if (val) setAdminSecret(val);
        else setAdminSecret('123456'); // Default suggestion
    });
  }, [apiUrl]);

  const handleSaveSecret = async () => {
      await DB.saveSetting('adminSecret', adminSecret);
      alert('Admin Secret gespeichert.');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        await DB.uploadDatabaseFile(e.target.files[0]);
        await onRefreshData();
        alert('Datenbank erfolgreich importiert!');
      } catch (err) {
        console.error(err);
        alert('Fehler beim Importieren der Datenbank.');
      }
    }
  };

  const handleAddModule = async () => {
    if (!newModule.id || !newModule.label) return;
    await DB.addModule(newModule);
    setNewModule({ id: '', label: '', description: '', iconName: 'Server' });
    await onRefreshData();
  };

  const handleDeleteModule = async (id: string) => {
    if (confirm('Modul wirklich löschen?')) {
      await DB.deleteModule(id);
      await onRefreshData();
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-gray-900">System Einstellungen</h2>
        <p className="text-gray-500">Konfiguration, Datenverwaltung und Schnittstellentests.</p>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6 overflow-x-auto">
        <button 
          onClick={() => setActiveSection('general')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeSection === 'general' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2">
            <HardDrive size={16} />
            Datenbank & System
          </div>
        </button>
        <button 
          onClick={() => setActiveSection('modules')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeSection === 'modules' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2">
             <LayoutGrid size={16} />
             Lizenz-Module
          </div>
        </button>
        <button 
          onClick={() => setActiveSection('logs')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeSection === 'logs' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2">
            <ScrollText size={16} />
            Request Logs
          </div>
        </button>
        <button 
          onClick={() => setActiveSection('api')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeSection === 'api' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2">
            <ServerCog size={16} />
            API Simulator
          </div>
        </button>
      </div>

      {/* CONTENT */}
      {activeSection === 'general' && (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Database size={18} className="text-blue-500" />
                  Backup & Restore
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Laden Sie die aktuelle SQLite Datenbank herunter oder stellen Sie einen alten Stand wieder her.
                </p>
                
                <div className="space-y-3">
                  <button 
                    onClick={() => DB.downloadDatabaseFile()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    <Download size={16} />
                    Datenbank herunterladen (.sqlite)
                  </button>

                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".sqlite,.db"
                      onChange={handleFileUpload}
                      className="hidden" 
                      id="db-upload"
                    />
                    <label 
                      htmlFor="db-upload"
                      className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition-colors cursor-pointer"
                    >
                      <Upload size={16} />
                      Datenbank hochladen
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Globe size={18} className="text-purple-600" />
                        API Endpunkt Konfiguration
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                    Definieren Sie die öffentliche URL, unter der die API erreichbar ist.
                    </p>
                    
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Public API Endpoint URL</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={localApiUrl}
                            onChange={(e) => setLocalApiUrl(e.target.value)}
                            className="flex-1 p-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="https://api..."
                        />
                        <button 
                            onClick={() => onSaveApiUrl(localApiUrl)}
                            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
                        >
                            Speichern
                        </button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Lock size={18} className="text-orange-600" />
                        Server Sync Authentifizierung
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                    Passwort für den Datenabgleich mit dem PHP-Backend.
                    </p>
                    
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Admin Secret</label>
                    <div className="flex gap-2">
                        <input 
                            type="password" 
                            value={adminSecret}
                            onChange={(e) => setAdminSecret(e.target.value)}
                            className="flex-1 p-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="Secret..."
                        />
                        <button 
                            onClick={handleSaveSecret}
                            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
                        >
                            Speichern
                        </button>
                    </div>
                </div>
              </div>
            </div>
        </div>
      )}

      {activeSection === 'modules' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus size={18} className="text-green-600" />
              Neues Modul anlegen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">ID (Key)</label>
                <input 
                  type="text" 
                  placeholder="z.B. drone_control" 
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  value={newModule.id}
                  onChange={e => setNewModule({...newModule, id: e.target.value})}
                />
              </div>
              <div className="lg:col-span-1">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Bezeichnung</label>
                <input 
                  type="text" 
                  placeholder="Drohnensteuerung" 
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  value={newModule.label}
                  onChange={e => setNewModule({...newModule, label: e.target.value})}
                />
              </div>
              <div className="lg:col-span-1">
                 <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Icon</label>
                 <select 
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                    value={newModule.iconName}
                    onChange={e => setNewModule({...newModule, iconName: e.target.value})}
                 >
                    {Object.keys(ICON_REGISTRY).map(key => (
                        <option key={key} value={key}>{key}</option>
                    ))}
                 </select>
              </div>
              <div className="lg:col-span-1">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Beschreibung</label>
                <input 
                  type="text" 
                  placeholder="Kurzbeschreibung..." 
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  value={newModule.description}
                  onChange={e => setNewModule({...newModule, description: e.target.value})}
                />
              </div>
              <button 
                onClick={handleAddModule}
                disabled={!newModule.id || !newModule.label}
                className="bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:opacity-50 h-[38px] flex items-center justify-center"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map(mod => {
                const Icon = ICON_REGISTRY[mod.iconName] || ICON_REGISTRY['Shield'];
                return (
                    <div key={mod.id} className="bg-white p-4 rounded-lg border border-gray-200 flex items-start justify-between group">
                        <div className="flex items-start gap-3">
                            <div className="bg-gray-100 p-2 rounded-lg text-gray-600">
                                <Icon size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-gray-900">{mod.label}</h4>
                                <p className="text-xs text-gray-500">{mod.description}</p>
                                <span className="text-[10px] font-mono text-gray-400 mt-1 block">ID: {mod.id}</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleDeleteModule(mod.id)}
                            className="text-gray-300 hover:text-red-600 transition-colors p-1"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                );
            })}
          </div>
        </div>
      )}

      {activeSection === 'logs' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
             <h3 className="font-bold text-gray-900 flex items-center gap-2">
               <ScrollText size={18} className="text-slate-600" />
               Eingehende Requests (History)
             </h3>
             <span className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-600">
                {apiLogs.length} Einträge
             </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-gray-500 font-bold border-b border-gray-200 text-xs uppercase tracking-wider">
                <tr>
                   <th className="p-4 w-40">Zeitstempel</th>
                   <th className="p-4">Origin (Quelle)</th>
                   <th className="p-4">API Key</th>
                   <th className="p-4">Method/Path</th>
                   <th className="p-4">Status</th>
                   <th className="p-4">Response Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                 {apiLogs.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400 italic">Keine Logs vorhanden.</td>
                    </tr>
                 ) : (
                    apiLogs.slice().reverse().map(log => (
                   <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                     <td className="p-4 whitespace-nowrap text-gray-600 font-mono text-xs">
                       {new Date(log.timestamp).toLocaleString('de-DE')}
                     </td>
                     <td className="p-4 font-mono text-blue-600 font-medium">
                       {log.sourceUrl}
                     </td>
                     <td className="p-4 font-mono text-xs">
                       {log.providedKey ? (
                           <span className="bg-yellow-50 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-100">{log.providedKey}</span>
                       ) : (
                           <span className="text-gray-400 italic">Auto-Reg</span>
                       )}
                     </td>
                     <td className="p-4 text-xs font-mono text-gray-500">
                        {log.method} {log.endpoint}
                     </td>
                     <td className="p-4">
                       <span className={`px-2 py-1 rounded text-xs font-bold border ${
                         log.responseStatus === 200 || log.responseStatus === 201 
                         ? 'bg-green-50 text-green-700 border-green-100' 
                         : 'bg-red-50 text-red-700 border-red-100'
                       }`}>
                         {log.responseStatus}
                       </span>
                     </td>
                     <td className="p-4 text-xs font-mono text-gray-500 max-w-[200px]">
                       <div className="truncate" title={log.responseBody}>
                         {log.responseBody}
                       </div>
                     </td>
                   </tr>
                 )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'api' && (
        <ApiConsole logs={apiLogs} onApiRequest={onApiRequest} apiUrl={apiUrl} />
      )}
    </div>
  );
};