import React from 'react';
import { LoreType } from '../types';
import { Users, MapPin, Zap, Brain, Gem, BookOpen } from 'lucide-react';

export const LORE_TYPE_CONFIG: Record<LoreType, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  accentHex: string;
}> = {
  [LoreType.FACTION]: {
    label: 'Faction',
    icon: React.createElement(Users, { className: 'w-3.5 h-3.5' }),
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    accentHex: '#4A72C4',
  },
  [LoreType.LOCATION]: {
    label: 'Location',
    icon: React.createElement(MapPin, { className: 'w-3.5 h-3.5' }),
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    accentHex: '#1DAF9E',
  },
  [LoreType.EVENT]: {
    label: 'Event',
    icon: React.createElement(Zap, { className: 'w-3.5 h-3.5' }),
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    accentHex: '#C4713C',
  },
  [LoreType.CONCEPT]: {
    label: 'Concept',
    icon: React.createElement(Brain, { className: 'w-3.5 h-3.5' }),
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    accentHex: '#6366D8',
  },
  [LoreType.ARTIFACT]: {
    label: 'Artifact',
    icon: React.createElement(Gem, { className: 'w-3.5 h-3.5' }),
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    accentHex: '#D4506A',
  },
  [LoreType.RULE]: {
    label: 'Canon Rule',
    icon: React.createElement(BookOpen, { className: 'w-3.5 h-3.5' }),
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    accentHex: '#1AA3B8',
  },
};
