
import React, { useState, useRef, useEffect } from 'react';
import { Send, Globe, Key, Code, ArrowRight, Copy, Server, ServerCog, AlertTriangle, FileJson, Terminal, Download, FileCode, CheckCircle2 } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'console' | 'backend'>('console');
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
    alert('Code in die Zwischenablage kopiert!');
  };

  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Generate Snippets
  const jsFetch = `// NOTE: Funktioniert jetzt direkt hier im Browser!
fetch('${apiUrl}', {
  method: 'POST',
  headers: {
    'Origin': 'https://${sourceUrl}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    key: '${apiKey || ''}' // Leer lassen für Auto-Reg
  })
})
.then(res => res.json())
.then(data => {
  console.log('Server Response:', data);
  if(data.status === 'requested') {
    console.log('Anfrage erstellt. Bitte auf Freischaltung warten.');
  } else if(data.status === 'expired') {
    console.error('LIZENZ ABGELAUFEN am ' + data.validUntil);
  } else if (data.key) {
    console.log('LIZENZ ERHALTEN:', data.key);
    console.log('MODULE:', data.modules);
  }
})
.catch(err => console.error('API Error:', err));`;

  const htaccessCode = `RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]

# CORS Headers (Optional, falls Server dies nicht sendet)
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "POST, GET, OPTIONS"
    Header set Access-Control-Allow-Headers "Content-Type, Origin, X-Auth-Token"
</IfModule>`;

  const phpBackendCode = `<?php
/*
 * SERVER BACKEND IMPLEMENTATION - FFw License Manager
 * 
 * INSTALLATION:
 * 1. Laden Sie diese Datei als 'index.php' auf Ihren Webspace.
 * 2. Stellen Sie sicher, dass der Ordner SCHREIBRECHTE (chmod 775 oder 777) hat.
 * 3. Die Datenbank 'ffw