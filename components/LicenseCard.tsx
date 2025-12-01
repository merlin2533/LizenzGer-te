
import React, { useState, useEffect } from 'react';
import { License, FeatureSet, ModuleDefinition } from '../types';
import { ShieldCheck, ShieldAlert, Check, Globe, Phone, Pencil, Save, X, MessageSquare, Building2, User, Mail, Calendar } from 'lucide-react';
import { ICON_REGISTRY } from '../config';

interface LicenseCardProps {
  license: License;
  onUpdateFeatures: (id: string, features: FeatureSet) => void;
  onUpdateDetails: (id: string, details: Partial<License>) => Promise<void> | void;
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

export const LicenseCard: React.FC<LicenseCardProps> = ({ license, onUpdateFeatures, onUpdateDetails, onRevoke, availableModules }) => {
  const isExpired = new Date(license.validUntil) < new Date();
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit State
  const [org, setOrg] = useState(license.organization);
  const [contact, setContact] = useState(license.contactPerson);
  const [email, setEmail] = useState(license.email);
  const [phone, setPhone] = useState(license.phoneNumber || '');
  const [note, setNote] = useState(license.note || '');
  const [validUntil, setValidUntil] = useState(license.validUntil);

  // Sync state with props when license updates (but not while editing to avoid overwriting user input)
  useEffect(() => {
    if (!isEditing) {
        setOrg(license.organization);
        setContact(license.contactPerson);
        setEmail(license.email);
        setPhone(license.phoneNumber || '');
        setNote(license.note || '');
        setValidUntil(license.validUntil);
    }
  }, [license, isEditing]);

  const toggleFeature = (key: string) => {
    if (isEditing) return; // Prevent toggling while editing details
    const newFeatures = { ...license.features, [key]: !license.features[key] };
    onUpdateFeatures(license.id, newFeatures);
  };

  const handleSave = async () => {
    await onUpdateDetails(license.id, {
        organization: org,
        contactPerson: contact,
        email: email,
        phoneNumber: phone,
        note: note,
        validUntil: validUntil
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setOrg(license.organization);
    setContact(license.contactPerson);
    setEmail(license.email);
    setPhone(license.phoneNumber || '');
    setNote(license.note || '');
    setValidUntil(license.validUntil);
    setIsEditing(false);
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all group ${isEditing ? 'ring-2 ring-red-500 border-transparent shadow-lg' : 'hover:shadow-md hover:border-red-100'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 mr-4">
          {isEditing ? (
            <div className="space-y-3 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1 mb-1"><Building2 size={10} /> Organisation</label>
                        <input type="text" value={org} onChange={e => setOrg(e.target.value)} className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-red-500 outline-none" />
                    </div>
                     <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1 mb-1"><User size={10} /> Ansprechpartner</label>
                        <input type="text" value={contact} onChange={e => setContact(e.target.value)} className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-red-500 outline-none" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1 mb-1"><Mail size={10} /> Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-red-500 outline-none" />
                    </div>
                     <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1 mb-1"><Phone size={10} /> Telefon</label>
                        <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-red-500 outline-none" />
                    </div>
                </div>
                 <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1 mb-1"><Calendar size={10} /> Gültig bis</label>
                    <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-red-500 outline-none" />
                </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1
            ${license.status === 'active' && !isExpired ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {license.status === 'active' && !isExpired ? <Check size={12} /> : <ShieldAlert size={12} />}
            {isExpired ? 'Abgelaufen' : (license.status === 'active' ? 'Aktiv' : 'Gesperrt')}
            </div>

            {!isEditing && (
                <button 
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Stammdaten bearbeiten"
                >
                    <Pencil size={14} />
                </button>
            )}
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 mb-4 font-mono text-xs text-slate-600 break-all border border-slate-100 flex justify-between items-center">
        <span>{license.key}</span>
      </div>

      {/* Note / Comment Field */}
      {(license.note || isEditing) && (
        <div className={`mb-4 ${isEditing ? '' : 'bg-yellow-50 border border-yellow-100 p-3 rounded-lg'}`}>
            {isEditing ? (
                <div>
                     <label className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1 mb-1"><MessageSquare size={10} /> Interner Kommentar / Notiz</label>
                    <textarea 
                        value={note} 
                        onChange={e => setNote(e.target.value)} 
                        className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-1 focus:ring-red-500 outline-none h-20 resize-none"
                        placeholder="Interne Notizen hier eingeben..."
                    />
                </div>
            ) : (
                <div className="flex items-start gap-2 text-xs text-yellow-800">
                    <MessageSquare size={12} className="mt-0.5 shrink-0 opacity-50" />
                    <p className="italic">{license.note}</p>
                </div>
            )}
        </div>
      )}

      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-3 tracking-wider flex items-center justify-between">
          <span>Freigeschaltete Funktionen</span>
          <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
             {isEditing ? 'Gesperrt während Bearbeitung' : 'Click to Toggle'}
          </span>
        </p>
        <div className={`flex gap-3 flex-wrap ${isEditing ? 'opacity-50 pointer-events-none' : ''}`}>
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
        <span className="text-gray-400 text-xs">
            {!isEditing && `Gültig bis: ${new Date(license.validUntil).toLocaleDateString('de-DE')}`}
        </span>
        
        {isEditing ? (
            <div className="flex gap-2 w-full justify-end">
                <button onClick={handleCancel} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded">
                    <X size={14} /> Abbrechen
                </button>
                <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded shadow-sm">
                    <Save size={14} /> Speichern
                </button>
            </div>
        ) : (
            <button 
            onClick={() => onRevoke(license.id)}
            className="text-red-600 hover:text-red-700 font-medium text-xs hover:underline"
            >
            Lizenz widerrufen
            </button>
        )}
      </div>
    </div>
  );
};