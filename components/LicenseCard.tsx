
import React from 'react';
import { License, FeatureSet, ModuleDefinition } from '../types';
import { ShieldCheck, ShieldAlert, Check, Globe, Phone } from 'lucide-react';
import { ICON_REGISTRY } from '../config';

interface LicenseCardProps {
  license: License;
  onUpdateFeatures: (id: string, features: FeatureSet) => void;
  onRevoke: (id: string) => void;
  availableModules: ModuleDefinition[];
}

const FeatureIcon = ({ moduleDef, active }: { moduleDef: ModuleDefinition, active: boolean }) => {
  const Icon = ICON_REGISTRY[moduleDef.iconName] || ShieldCheck;
  const label = moduleDef.label;
  const colorClass = active ? "text-red-600" : "text-gray-300";

  return (
    <div className="flex flex-col items-center gap-1 group relative">
      <div className={`p-2 rounded-full transition-colors ${active ? 'bg-red-50 ring-1 ring-red-100' : 'bg-gray-50'}`}>
        <Icon className={`w-5 h-5 ${colorClass}`} />
      </div>
      <span className="text-[10px] uppercase font-bold text-gray-500 truncate max-w-[60px] text-center">{label}</span>
      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs p-2 rounded shadow-lg whitespace-nowrap z-10">
        <p className="font-bold">{label}</p>
        <p className="font-normal opacity-75">{moduleDef.description}</p>
        <p className="font-normal opacity-75 mt-1 border-t border-gray-700 pt-1">{active ? 'Aktiviert' : 'Deaktiviert'}</p>
      </div>
    </div>
  );
};

export const LicenseCard: React.FC<LicenseCardProps> = ({ license, onUpdateFeatures, onRevoke, availableModules }) => {
  const isExpired = new Date(license.validUntil) < new Date();
  
  const toggleFeature = (key: string) => {
    const newFeatures = { ...license.features, [key]: !license.features[key] };
    onUpdateFeatures(license.id, newFeatures);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all hover:shadow-md hover:border-red-100 group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{license.organization}</h3>
          <div className="flex items-center gap-2 mt-1">
             <Globe className="w-3 h-3 text-gray-400" />
             <a href={`https://${license.domain}`} target="_blank" rel="noreferrer" className="text-sm font-mono text-blue-600 hover:underline hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
               {license.domain}
             </a>
          </div>
          <div className="text-xs text-gray-400 mt-2 space-y-0.5">
             <p>{license.contactPerson}</p>
             <p>{license.email}</p>
             {license.phoneNumber && (
                <p className="flex items-center gap-1"><Phone size={10} /> {license.phoneNumber}</p>
             )}
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1
          ${license.status === 'active' && !isExpired ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {license.status === 'active' && !isExpired ? <Check size={12} /> : <ShieldAlert size={12} />}
          {isExpired ? 'Abgelaufen' : (license.status === 'active' ? 'Aktiv' : 'Gesperrt')}
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 mb-4 font-mono text-xs text-slate-600 break-all border border-slate-100 flex justify-between items-center">
        <span>{license.key}</span>
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-3 tracking-wider flex items-center justify-between">
          <span>Freigeschaltete Funktionen</span>
          <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">Editierbar</span>
        </p>
        <div className="flex gap-3 flex-wrap">
          {availableModules.map((module) => (
            <button 
              key={module.id} 
              onClick={() => toggleFeature(module.id)}
              className="focus:outline-none transition-transform active:scale-95"
              title={module.description}
            >
              <FeatureIcon moduleDef={module} active={!!license.features[module.id]} />
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
        <span className="text-gray-400 text-xs">Gültig bis: {new Date(license.validUntil).toLocaleDateString('de-DE')}</span>
        <button 
          onClick={() => onRevoke(license.id)}
          className="text-red-600 hover:text-red-700 font-medium text-xs hover:underline"
        >
          Lizenz widerrufen
        </button>
      </div>
    </div>
  );
};
