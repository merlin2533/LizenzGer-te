
import { 
  Server, Wind, Droplet, Truck, Database, Activity, 
  Shield, FireExtinguisher, Siren, HardHat, Radio, 
  BriefcaseMedical, Map, Users, BarChart3, Wrench 
} from 'lucide-react';
import { ModuleDefinition } from './types';

// Registry of available icons that can be selected for modules
export const ICON_REGISTRY: { [key: string]: any } = {
  Server, Wind, Droplet, Truck, Database, Activity,
  Shield, FireExtinguisher, Siren, HardHat, Radio,
  BriefcaseMedical, Map, Users, BarChart3, Wrench
};

// Initial Seed Data for the Database
export const DEFAULT_MODULES_SEED: ModuleDefinition[] = [
  { 
    id: 'inventory', 
    label: 'Grundinventar', 
    description: 'Verwaltung von Geräten und Lagerorten', 
    iconName: 'Server' 
  },
  { 
    id: 'respiratory', 
    label: 'Atemschutz', 
    description: 'Atemschutzwerkstatt & Prüfungen', 
    iconName: 'Wind' 
  },
  { 
    id: 'hoses', 
    label: 'Schlauchpflege', 
    description: 'Schlauchwäsche & Prüfung', 
    iconName: 'Droplet' 
  },
  { 
    id: 'vehicles', 
    label: 'Fahrtenbuch', 
    description: 'Digitales Fahrtenbuch & Tanken', 
    iconName: 'Truck' 
  },
  { 
    id: 'apiAccess', 
    label: 'API Zugriff', 
    description: 'Zugriff für externe Systeme', 
    iconName: 'Database' 
  },
  {
    id: 'personnel',
    label: 'Personal',
    description: 'Mannschaftsverwaltung & Lehrgänge',
    iconName: 'Users'
  }
];
