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
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    accentHex: '#3b82f6',
  },
  [LoreType.LOCATION]: {
    label: 'Location',
    icon: React.createElement(MapPin, { className: 'w-3.5 h-3.5' }),
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    accentHex: '#10b981',
  },
  [LoreType.EVENT]: {
    label: 'Event',
    icon: React.createElement(Zap, { className: 'w-3.5 h-3.5' }),
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    accentHex: '#f59e0b',
  },
  [LoreType.CONCEPT]: {
    label: 'Concept',
    icon: React.createElement(Brain, { className: 'w-3.5 h-3.5' }),
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    accentHex: '#8b5cf6',
  },
  [LoreType.ARTIFACT]: {
    label: 'Artifact',
    icon: React.createElement(Gem, { className: 'w-3.5 h-3.5' }),
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    accentHex: '#f43f5e',
  },
  [LoreType.RULE]: {
    label: 'Canon Rule',
    icon: React.createElement(BookOpen, { className: 'w-3.5 h-3.5' }),
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    accentHex: '#06b6d4',
  },
};
