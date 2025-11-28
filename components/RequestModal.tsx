
import React, { useState, useEffect } from 'react';
import { LicenseRequest, FeatureSet, DEFAULT_FEATURES, ModuleDefinition } from '../types';
import { generateWelcomeEmail, analyzeRequest } from '../services/geminiService';
import { Loader2, Wand2, Mail } from 'lucide-react';

interface RequestModalProps {
  request: LicenseRequest;
  onClose: () => void;
  onApprove: (request: LicenseRequest, features: FeatureSet, validUntil: string, emailContent: string) => void;
  availableModules: ModuleDefinition[];
}

export const RequestModal: React.FC<RequestModalProps> = ({ request, onClose, onApprove, availableModules }) => {
  const [features, setFeatures] = useState<FeatureSet>(DEFAULT_FEATURES);
  const [validUntil, setValidUntil] = useState<string>(
    new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
  );
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
    const email = await generateWelcomeEmail(
      request.organization,
      request.contactPerson,
      dummyKey,
      features,
      validUntil
    );

    setEmailContent(email);
    setIsGenerating(false);
  };

  const handleConfirm = () => {
    onApprove(request, features, validUntil, emailContent);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Anfrage bearbeiten</h2>
          <p className="text-gray-500 text-sm mt-1">Lizenz für {request.organization} erstellen</p>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Info Section */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="block text-gray-400 text-xs uppercase font-bold">Kontakt</span>
              <p className="font-medium text-gray-900">{request.contactPerson}</p>
              <p className="text-gray-600">{request.email}</p>
            </div>
            <div>
              <span className="block text-gray-400 text-xs uppercase font-bold">Domain (Source)</span>
              <p className="font-mono bg-gray-100 px-2 py-1 rounded inline-block mt-1 text-gray-800">{request.requestedDomain}</p>
            </div>
          </div>

          {/* AI Analysis */}
          {request.note && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-700 uppercase">AI Analyse der Notiz</span>
              </div>
              <p className="text-sm text-gray-600 italic">"{request.note}"</p>
              <div className="mt-3 text-sm text-blue-800 font-medium">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : aiAnalysis}
              </div>
            </div>
          )}

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
              className="w-full py-3 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-lg font-medium shadow-lg shadow-gray-200 hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 size={18} />}
              Lizenz generieren & E-Mail entwerfen
            </button>
          ) : (
            <div className="space-y-4 animate-fade-in">
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
