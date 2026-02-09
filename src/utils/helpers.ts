import { Character, Era } from '../types';

export const genId = () => crypto.randomUUID();

export const timeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const generateMasterPrompt = (character: Character, eraId?: string | null): string => {
  const era = character.eras.find(e => e.id === (eraId || character.eras[0]?.id));
  if (!era) return `${character.name}, ${character.archetype}`;

  const eraContext = era.name ? `[${era.name}]` : '';
  const age = era.age_appearance ? `${era.age_appearance}, ` : '';
  const tags = era.visual_tags.length > 0 ? era.visual_tags.join(', ') : '';

  return `${character.name} ${eraContext}, ${character.archetype}, ${age}${tags}`.trim();
};

export const createDefaultEra = (name = 'Origin'): Era => ({
  id: genId(),
  name,
  visual_tags: [],
  age_appearance: '',
});

export const createDefaultCharacter = (): Omit<Character, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  role: 'Supporting',
  archetype: '',
  eras: [createDefaultEra()],
  voice_profile: { samples: [], style: '' },
  smart_tags: { Faction: '', Status: 'Active' },
  gallery: [],
  loreEntryIds: [],
});
