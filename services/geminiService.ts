
import { GoogleGenAI } from "@google/genai";
import { FeatureSet } from "../types";

export const generateWelcomeEmail = async (
  organization: string,
  contactPerson: string,
  key: string,
  features: FeatureSet,
  validUntil: string
): Promise<string> => {
  // Fallback content if no API Key is provided, preventing the "Set API Key" error
  if (!process.env.API_KEY) {
    const featureList = Object.entries(features)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => {
        switch (key) {
          case 'inventory': return 'Grundinventar';
          case 'respiratory': return 'Atemschutz';
          case 'hoses': return 'Schlauchmanagement';
          case 'vehicles': return 'Fahrtenbuch';
          case 'apiAccess': return 'API';
          default: return key;
        }
      })
      .join(', ');

    return `Betreff: Willkommen beim FFw-Gerätewart Manager - Ihre Lizenz

Sehr geehrte Damen und Herren,
hallo ${contactPerson},

vielen Dank für Ihre Registrierung für "${organization}".

Ihre Lizenz wurde erfolgreich generiert.
Lizenzschlüssel: ${key}
Gültig bis: ${new Date(validUntil).toLocaleDateString('de-DE')}

Freigeschaltete Module:
${featureList}

Bitte tragen Sie diesen Schlüssel in den Einstellungen Ihrer Installation ein.

Mit freundlichen Grüßen
Ihr Support Team`;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const featureList = Object.entries(features)
    .filter(([_, enabled]) => enabled)
    .map(([key]) => {
      switch (key) {
        case 'inventory': return 'Grundinventar Verwaltung';
        case 'respiratory': return 'Atemschutzwerkstatt (Pro)';
        case 'hoses': return 'Schlauchmanagement';
        case 'vehicles': return 'Digitales Fahrtenbuch & Wartung';
        case 'apiAccess': return 'REST API Zugriff';
        default: return key;
      }
    })
    .join(', ');

  const prompt = `
    Du bist der Support-Bot für die Software "FFw-Gerätewart Manager".
    Erstelle eine professionelle, freundliche Willkommens-E-Mail auf Deutsch für einen neuen Kunden.
    
    Kunde: ${organization}
    Ansprechpartner: ${contactPerson}
    Lizenzschlüssel: ${key}
    Gültig bis: ${validUntil}
    Freigeschaltete Module: ${featureList}
    
    Die E-Mail soll bestätigen, dass die Lizenz erstellt wurde, die Module auflisten und kurz erklären, was der nächste Schritt ist (Eingabe des Schlüssels in den Einstellungen).
    Halte es kurz und professionell.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Konnte keine E-Mail generieren.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Fehler bei der Generierung der E-Mail (API Fehler).";
  }
};

export const analyzeRequest = async (note: string, organization: string): Promise<string> => {
   if (!process.env.API_KEY) return "";
   
   const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
   const prompt = `
     Analysiere diese Kundenanfrage für eine Feuerwehr-Software.
     Organisation: ${organization}
     Notiz des Kunden: "${note}"
     
     Gib eine kurze Empfehlung (max 2 Sätze), welche Module (Atemschutz, Schläuche, Fahrzeuge) für diesen Kunden basierend auf der Notiz sinnvoll wären.
   `;

   try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "";
   } catch (error) {
     return "";
   }
}