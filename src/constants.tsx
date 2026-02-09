
import React from 'react';
import { AspectRatio } from './types';

export const ART_STYLES = [
    // Noir & Crime
    { id: 'classic-noir', name: 'Classic Film Noir', prompt: 'classic film noir comic book style, high contrast black and white ink, deep shadows, cinematic lighting, gritty texture, professional linework' },
{ id: 'sin-city', name: 'Sin City Style', prompt: 'stark Sin City style high contrast black and white, heavy ink, deep blacks, selective red accents, silhouette lighting, minimalist grit' },
{ id: 'crime-noir', name: 'Gritty Crime Noir', prompt: 'gritty urban crime comic art, hard-boiled detective noir, rainy city streets, fedoras and trench coats, dramatic shadows, moody palette' },
{ id: 'will-eisner', name: 'Spirit Noir (Eisner)', prompt: 'Will Eisner Spirit-style noir, expressive cinematic storytelling, creative environmental integration, atmospheric urban settings, soft ink washes' },

// Superhero
{ id: 'bronze-superhero', name: 'Bronze Age (1970s)', prompt: '1970s bronze age superhero comic book art, dynamic action poses, thick ink outlines, vibrant flat colors with Ben-Day dots, expressive faces' },
{ id: 'silver-superhero', name: 'Silver Age (1960s)', prompt: '1960s silver age superhero comic book art, clean heroic proportions, bright primary colors, classic four-color printing look, optimistic heroic style' },
{ id: 'kirby-cosmic', name: 'Kirby Cosmic', prompt: 'Jack Kirby style cosmic superhero art, bold blocky shapes, Kirby crackle energy, epic scale, hyper-dynamic anatomy, geometric power' },
{ id: 'alex-ross', name: 'Painted Realism (Ross)', prompt: 'Alex Ross style hyper-realistic painted superhero art, photorealistic gouache painting, classical heroic lighting, masterpiece quality, cinematic realism' },
{ id: 'frank-miller', name: 'Gritty Miller Style', prompt: 'Frank Miller gritty comic art, heavy expressionistic ink work, blocky angular shadows, dark brooding atmosphere, muscular silhouettes' },

// Horror
{ id: 'ec-horror', name: 'EC Horror (50s)', prompt: 'classic 1950s horror comic book style, detailed macabre illustrations, grotesque monsters, heavy ink shading, EC comics aesthetic, vibrant retro colors' },
{ id: 'vertigo-horror', name: 'Vertigo Horror (90s)', prompt: 'moody 1990s Vertigo horror comic art, psychological dark fantasy, painterly textures, atmospheric and surreal lighting, sophisticated color palette' },
{ id: 'mignola-hellboy', name: 'Hellboy Style (Mignola)', prompt: 'Mike Mignola style folk horror, blocky heavy shadows, simplified geometric shapes, high contrast flat colors, gothic atmosphere, minimalist shapes' },

// Indie & European
{ id: 'underground-comix', name: 'Underground Comix', prompt: '1960s underground comix style, R. Crumb-inspired raw ink work, heavy cross-hatching, satirical distorted proportions, detailed messy textures' },
{ id: 'indie-minimalist', name: 'Indie Minimalist', prompt: 'indie graphic novel style, clean minimalist line art, emotional realism, sophisticated composition, muted color palette, Chris Ware influence' },
{ id: 'clear-line', name: 'Clear-Line (Tintin)', prompt: 'European clear-line (ligne claire) style, precise uniform ink outlines, flat colors, no hatching, clean readable backgrounds, Hergé aesthetic' },
{ id: 'european-bd', name: 'European BD Adventure', prompt: 'modern European BD adventure art, realistic proportions, intricate background details, sophisticated color grading, Moebius influence' },
{ id: 'modern-alt', name: 'Modern Indie Alt', prompt: 'modern indie alt-comic style, loose sketchy line work, contemporary emotional storytelling, minimal shading, Adrian Tomine vibe' },

// Experimental & Realistic
{ id: 'erotic-realism', name: 'Photorealistic', prompt: 'ultra photorealistic sensual erotic portrait, detailed realistic skin texture and anatomy, soft intimate lighting, cinematic chiaroscuro, tasteful artistic sensual pose, high detail masterpiece, no cartoon elements' },
{ id: 'pulp-adventure', name: 'Retro Pulp Adventure', prompt: 'retro 1930s pulp magazine cover art, dynamic adventure serials, warm vintage palette, hand-painted texture, dramatic heroic action' },
    { id: 'cyberpunk-noir', name: 'Western Cyberpunk Noir', prompt: 'Western cyberpunk neon-noir comic art, intricate mechanical details, glowing accents, gritty high-tech low-life aesthetic, intense lighting' },

    // Americana & Subverted Wholesome
    { id: 'norman-rockwell', name: 'Norman Rockwell', prompt: 'Norman Rockwell illustration style, folksy Americana, warm nostalgic palette, Saturday Evening Post aesthetic, detailed realistic figures, idyllic small-town scenes, homespun warmth with subtle underlying tension, masterful composition' },
    { id: 'kinkade-luminous', name: 'Kinkade Luminous', prompt: 'Thomas Kinkade style, luminous glowing cottages, idyllic pastoral landscapes, soft diffused golden light, painterly warmth, ethereal glow effects, cozy nostalgic atmosphere, romanticized nature' },
    { id: 'lisa-frank', name: 'Lisa Frank', prompt: 'Lisa Frank style, hypersaturated neon rainbow colors, sparkles and glitter effects, 90s aesthetic, kawaii cute characters, gradient backgrounds, maximalist whimsy, unicorns and dolphins, bold outlines' },

    // Dark Fantasy & Horror (add to existing Horror group)
    { id: 'hellraiser', name: 'Hellraiser', prompt: 'Clive Barker Hellraiser aesthetic, cenobite body horror, leather and chains, puzzle box motifs, sadomasochistic nightmare imagery, dim crimson and black palette, intricate geometric torture designs, flesh and metal fusion' },
    { id: 'spawn-mcfarlane', name: 'Spawn (McFarlane)', prompt: 'Todd McFarlane Spawn style, elaborate flowing capes with impossible detail, hellfire green necroplasm glow, gritty urban supernatural, heavy dramatic shadows, dynamic exaggerated poses, chains skulls and spikes, 90s Image comics energy' },

    // Epic Sci-Fi (new group or add to Realistic & Experimental)
    { id: 'dune-epic', name: 'Dune', prompt: 'Dune aesthetic, epic desert landscapes, ornate stillsuits with intricate detail, sandworm scale and grandeur, spice-blue eyes, arid orange ochre and deep blue palette, Frank Herbert vision, baroque sci-fi grandeur, harsh sunlight and deep shadows' },

    // Custom - this is a special one
    { id: 'custom', name: '✏️ Custom Style', prompt: '' }
];

export const ASPECT_CONFIGS: Record<AspectRatio, { label: string; class: string; ratio: string }> = {
    [AspectRatio.WIDE]: { label: 'Wide (16:9)', class: 'aspect-panel-wide', ratio: '16:9' },
    [AspectRatio.STD]: { label: 'Standard (4:3)', class: 'aspect-panel-std', ratio: '4:3' },
    [AspectRatio.SQUARE]: { label: 'Square (1:1)', class: 'aspect-panel-square', ratio: '1:1' },
    [AspectRatio.TALL]: { label: 'Tall (3:4)', class: 'aspect-panel-tall', ratio: '3:4' },
    [AspectRatio.PORTRAIT]: { label: 'Portrait (9:16)', class: 'aspect-panel-portrait', ratio: '9:16' }
};

// Generation delay between panels in batch operations (in milliseconds)
export const GENERATION_DELAY_MS = 1200;

export const Icons = {
    Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Magic: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    Folder: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
    ChevronLeft: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
    ChevronRight: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
    User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Sparkle: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
    X: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    Loader: () => <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>,
    Chat: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    Phone: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    Caption: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>,
};
