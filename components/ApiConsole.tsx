
import React, { useState, useRef, useEffect } from 'react';
import { Send, Globe, Key, Code, ArrowRight, Copy, Server, ServerCog } from 'lucide-react';
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
    // Could add toast here
  };

  // Generate Snippets
  const curlInit = `curl -X POST ${apiUrl} \\
  -H "Origin: https://${sourceUrl}"`;
  
  const curlVerify = `curl -X POST ${apiUrl} \\
  -H "Origin: https://${sourceUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "${apiKey || 'YOUR_API_KEY'}"}'`;

  const jsFetch = `fetch('${apiUrl}', {
  method: 'POST',
  headers: {
    'Origin': 'https://${sourceUrl}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    key: '${apiKey || ''}' // Leave empty for auto-registration
  })
})
.then(res => res.json())
.then(data => {
  if(data.status === 'expired') {
    console.error('License expired on ' + data.validUntil);
    // Disable Features
  } else {
    console.log('Active Modules:', data.modules);
    console.log('Days Remaining:', data.daysRemaining);
  }
});`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
      
      {/* Left Column: Input & Documentation */}
      <div className="lg:col-span-1 flex flex-col gap-6 overflow-y-auto pr-1">
        
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
              <p className="text-[10px] text-gray-400 mt-1">
                Leer: Registrierung (Key Gen). <br/>Ausgefüllt: Validierung & Module.
              </p>
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
             <Server className="w-4 h-4 text-slate-700" />
             <h3 className="text-sm font-bold text-slate-800 uppercase">Integration für 3rd Party</h3>
           </div>

           <div className="mb-4">
             <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">API Endpoint</label>
             <div className="bg-white border border-slate-200 rounded p-2 font-mono text-xs text-slate-600 select-all break-all">
               POST {apiUrl}
             </div>
           </div>

           <div className="space-y-4">
             <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">cURL (Init)</label>
                  <button onClick={() => copyToClipboard(curlInit)} className="text-slate-400 hover:text-slate-600"><Copy size={12} /></button>
                </div>
                <pre className="bg-slate-800 text-green-400 p-2 rounded text-[10px] overflow-x-auto whitespace-pre-wrap font-mono">
                  {curlInit}
                </pre>
             </div>

             <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Javascript Client</label>
                  <button onClick={() => copyToClipboard(jsFetch)} className="text-slate-400 hover:text-slate-600"><Copy size={12} /></button>
                </div>
                <pre className="bg-slate-800 text-blue-300 p-2 rounded text-[10px] overflow-x-auto whitespace-pre-wrap font-mono">
                  {jsFetch}
                </pre>
             </div>
           </div>
        </div>

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
                        <span className="text-slate-500 text-xs italic block">Auto-Registration</span>
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
