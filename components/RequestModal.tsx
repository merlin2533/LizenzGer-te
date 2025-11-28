
import React, { useState, useEffect } from 'react';
import { LicenseRequest, FeatureSet, DEFAULT_FEATURES, ModuleDefinition } from '../types';
import { generateWelcomeEmail, analyzeRequest } from '../services/geminiService';
import { Loader2, Wand2, Mail, Building2, User, Phone, Globe, MessageSquare } from 'lucide-react';

interface RequestModalProps {
  request: LicenseRequest;
  onClose: () => void;
  onApprove: (
    request: LicenseRequest, 
    updatedDetails: { organization: string, contactPerson: string, email: string, phoneNumber: string },
    features: FeatureSet, 
    validUntil: string, 
    emailContent: string
  ) => void;
  availableModules: ModuleDefinition[];
}

export const RequestModal: React.FC<RequestModalProps> = ({ request, onClose, onApprove, availableModules }) => {
  const [features, setFeatures] = useState<FeatureSet>(DEFAULT_FEATURES);
  const [validUntil, setValidUntil] = useState<string>(
    new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
  );
  
  // Editable Fields State
  const [org, setOrg] = useState(request.organization);
  const [contact, setContact] = useState(request.contactPerson);
  const [email, setEmail] = useState(request.email);
  const [phone, setPhone] = useState(request.phoneNumber || '');

  const [isGenerating, setIsGenerating] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (request.note) {
      setAnalyzing(true);
      analyzeRequest(request.note, request.organization).then(text => {
        setAiAnalysis(text);
        setAnalyzing(false);
      });
    }
  }, [request]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    // Simulate Key Generation (UUID-like)
    const dummyKey = `FFW-${Math.random().toString(36).substr(2, 5).toUpperCase()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}-${new Date().getFullYear()}`;
    
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
  };

  const handleConfirm = () => {
    onApprove(
        request, 
        { organization: org, contactPerson: contact, email, phoneNumber: phone },
        features, 
        validUntil, 
        emailContent
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Anfrage bearbeiten</h2>
          <p className="text-gray-500 text-sm mt-1">Lizenzdetails vervollständigen und genehmigen</p>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Editable Contact Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-3">
                <div>
                   <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                      <Building2 size={12} /> Organisation
                   </label>
                   <input 
                      type="text" 
                      value={org}
                      onChange={(e) => setOrg(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                      <User size={12} /> Ansprechpartner
                   </label>
                   <input 
                      type="text" 
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                   />
                </div>
             </div>
             <div className="space-y-3">
                <div>
                   <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                      <Mail size={12} /> Email
                   </label>
                   <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                      <Phone size={12} /> Telefon / Handy
                   </label>
                   <input 
                      type="text" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+49 ..."
                      className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                   />
                </div>
             </div>
          </div>

          <div>
             <span className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                <Globe size={12} /> Angefragte Domain (Origin)
             </span>
             <p className="font-mono bg-gray-100 px-3 py-2 rounded text-sm text-gray-800 border border-gray-200">{request.requestedDomain}</p>
          </div>

          {/* AI Analysis */}
          {request.note && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-700 uppercase">Notiz & KI Analyse</span>
              </div>
              <p className="text-sm text-gray-600 italic mb-2">"{request.note}"</p>
              <div className="text-sm text-blue-800 font-medium pl-2 border-l-2 border-blue-200">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : aiAnalysis}
              </div>
            </div>
          )}

          {/* Feature Configuration */}
          <div className="border-t border-gray-100 pt-4">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gültig bis</label>
            <input 
              type="date" 
              value={validUntil} 
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          {/* AI Email Generation */}
          {!emailContent ? (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-lg font-medium shadow-lg shadow-gray-200 hover:shadow-xl transition-all flex items-center justify-center gap-2 mt-4"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 size={18} />}
              Lizenz generieren & E-Mail entwerfen
            </button>
          ) : (
            <div className="space-y-4 animate-fade-in mt-4">
               <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 text-gray-500">
                    <Mail size={16} />
                    <span className="text-xs font-bold uppercase">Email Entwurf</span>
                  </div>
                  <textarea 
                    className="w-full bg-transparent text-sm text-gray-700 min-h-[150px] focus:outline-none resize-none"
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                  />
               </div>
               <div className="flex gap-3">
                 <button onClick={() => setEmailContent('')} className="flex-1 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Zurück</button>
                 <button onClick={handleConfirm} className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md shadow-red-200">
                   Bestätigen & Absenden
                 </button>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
