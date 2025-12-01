
import React, { useState } from 'react';
import { FeatureSet, DEFAULT_FEATURES, ModuleDefinition, License } from '../types';
import { generateWelcomeEmail } from '../services/geminiService';
import { Loader2, Wand2, Mail, Building2, User, Phone, Globe, Calendar, Save, X, Check } from 'lucide-react';

interface CreateLicenseModalProps {
  onClose: () => void;
  onSave: (
    details: { organization: string, contactPerson: string, email: string, phoneNumber: string, domain: string, note: string },
    features: FeatureSet, 
    validUntil: string,
    emailContent: string
  ) => Promise<void>;
  availableModules: ModuleDefinition[];
}

export const CreateLicenseModal: React.FC<CreateLicenseModalProps> = ({ onClose, onSave, availableModules }) => {
  const [features, setFeatures] = useState<FeatureSet>(DEFAULT_FEATURES);
  const [validUntil, setValidUntil] = useState<string>(
    new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
  );
  
  // Master Data State
  const [org, setOrg] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [domain, setDomain] = useState('');
  const [note, setNote] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [step, setStep] = useState<'details' | 'email'>('details');

  const handleGenerate = async () => {
    if (!org || !domain) {
        alert("Bitte Organisation und Domain angeben.");
        return;
    }

    const selectedDate = new Date(validUntil);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate <= today) {
        alert("Das 'Gültig bis' Datum muss in der Zukunft liegen.");
        return;
    }

    setIsGenerating(true);
    // Simulate Key Generation for Email Preview
    const dummyKey = `FFW-XXXX-XXXX-${new Date().getFullYear()}`;
    
    // Generate Email via Gemini
    const emailText = await generateWelcomeEmail(
      org,
      contact,
      dummyKey,
      features,
      validUntil
    );

    setEmailContent(emailText);
    setIsGenerating(false);
    setStep('email');
  };

  const handleConfirm = async () => {
    await onSave(
        { organization: org, contactPerson: contact, email, phoneNumber: phone, domain, note },
        features, 
        validUntil, 
        emailContent
    );
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Neue Lizenz erstellen</h2>
            <p className="text-gray-500 text-sm mt-1">Stammdaten manuell erfassen und Schlüssel generieren</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {step === 'details' && (
            <div className="space-y-6 animate-fade-in">
                {/* Stammdaten Section */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 uppercase mb-4 tracking-wider flex items-center gap-2">
                        <Building2 size={16} className="text-red-600" /> Stammdaten
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Organisation *</label>
                            <input 
                                type="text" 
                                value={org}
                                onChange={(e) => setOrg(e.target.value)}
                                placeholder="z.B. Freiwillige Feuerwehr Musterstadt"
                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Ansprechpartner</label>
                            <input 
                                type="text" 
                                value={contact}
                                onChange={(e) => setContact(e.target.value)}
                                placeholder="z.B. Max Mustermann"
                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Domain (Origin) *</label>
                            <div className="relative">
                                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="text" 
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    placeholder="ffw-musterstadt.de"
                                    className="w-full pl-9 p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:outline-none font-mono"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Gültig bis</label>
                            <div className="relative">
                                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="date" 
                                    value={validUntil}
                                    min={todayStr}
                                    onChange={(e) => setValidUntil(e.target.value)}
                                    className="w-full pl-9 p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Email</label>
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="info@..."
                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Telefon</label>
                            <input 
                                type="text" 
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+49 ..."
                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Interne Notiz</label>
                        <textarea 
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Interne Anmerkungen..."
                            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:outline-none h-20 resize-none"
                        />
                    </div>
                </div>

                {/* Feature Configuration */}
                <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Module freischalten</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableModules.map((module) => (
                        <label key={module.id} className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${features[module.id] ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input
                            type="checkbox"
                            checked={!!features[module.id]}
                            onChange={(e) => setFeatures({ ...features, [module.id]: e.target.checked })}
                            className="w-4 h-4 mt-0.5 text-red-600 border-gray-300 rounded focus:ring-red-500 shrink-0"
                        />
                        <div className="ml-3">
                            <span className="text-sm font-medium text-gray-700 block">{module.label}</span>
                            <span className="text-xs text-gray-500">{module.description}</span>
                        </div>
                        </label>
                    ))}
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !org || !domain}
                    className="w-full py-3 bg-slate-900 text-white rounded-lg font-medium shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 size={18} />}
                    Weiter zur Vorschau
                </button>
            </div>
          )}

          {step === 'email' && (
            <div className="space-y-4 animate-fade-in">
               <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 text-gray-500">
                    <Mail size={16} />
                    <span className="text-xs font-bold uppercase">Email Entwurf & Lizenz-Zusammenfassung</span>
                  </div>
                  <textarea 
                    className="w-full bg-transparent text-sm text-gray-700 min-h-[200px] focus:outline-none resize-none font-mono"
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                  />
               </div>

               <div className="bg-blue-50 p-3 rounded border border-blue-100 text-xs text-blue-800 flex items-start gap-2">
                   <Check size={14} className="mt-0.5" />
                   <p>Lizenz wird für <strong>{org}</strong> ({domain}) erstellt.<br/>Gültig bis: {new Date(validUntil).toLocaleDateString('de-DE')}</p>
               </div>

               <div className="flex gap-3">
                 <button onClick={() => setStep('details')} className="flex-1 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg border border-gray-200">Zurück</button>
                 <button onClick={handleConfirm} className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md shadow-red-200 flex items-center justify-center gap-2">
                   <Save size={16} /> Lizenz erstellen
                 </button>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
