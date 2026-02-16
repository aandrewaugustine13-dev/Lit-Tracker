import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, User, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { Character } from '../../types';
import { InkAction as Action } from '../../store/inkSlice';
import { genId } from '../../utils/helpers';
import EmptyState from './EmptyState';

interface Props {
    characters: Character[];
    dispatch: React.Dispatch<Action>;
    onClose: () => void;
}

interface CharacterFormData {
    name: string;
    description: string;
    appearance: NonNullable<Character['appearance']>;
}

const emptyAppearance: NonNullable<Character['appearance']> = {
    age: '',
    gender: '',
    ethnicity: '',
    height: '',
    build: '',
    hairColor: '',
    hairStyle: '',
    eyeColor: '',
    skinTone: '',
    facialFeatures: '',
    distinguishingMarks: '',
    clothing: '',
    accessories: '',
    additionalNotes: '',
};

const emptyForm: CharacterFormData = {
    name: '',
    description: '',
    appearance: { ...emptyAppearance },
};

export function CharacterBank({ characters, dispatch, onClose }: Props) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [formData, setFormData] = useState<CharacterFormData>({ ...emptyForm });

    const handleStartAdd = () => {
        setIsAdding(true);
        setEditingId(null);
        setFormData({ ...emptyForm });
    };

    const handleStartEdit = (char: Character) => {
        setEditingId(char.id);
        setIsAdding(false);
        setFormData({
            name: char.name,
            description: char.description || '',
            appearance: char.appearance ? { ...emptyAppearance, ...char.appearance } : { ...emptyAppearance },
        });
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingId(null);
        setFormData({ ...emptyForm });
    };

    const handleSave = () => {
        if (!formData.name.trim()) return;

        // Build a simple description from appearance if no description provided
        const autoDescription = buildDescriptionFromAppearance(formData.appearance);
        const finalDescription = formData.description.trim() || autoDescription;

        if (isAdding) {
            dispatch({
                type: 'ADD_CHARACTER',
                name: formData.name.trim(),
                description: finalDescription,
                appearance: formData.appearance,
            });
        } else if (editingId) {
            dispatch({
                type: 'UPDATE_CHARACTER',
                id: editingId,
                updates: {
                    name: formData.name.trim(),
                    description: finalDescription,
                    appearance: formData.appearance,
                },
            });
        }
        handleCancel();
    };

    const handleDelete = (id: string) => {
        if (confirm('Delete this character? They will be unlinked from all panels.')) {
            dispatch({ type: 'DELETE_CHARACTER', id });
        }
    };

    const updateAppearance = (field: keyof NonNullable<Character['appearance']>, value: string) => {
        setFormData(prev => ({
            ...prev,
            appearance: { ...prev.appearance, [field]: value },
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/10 z-[600] flex items-center justify-center p-4">
            <div className="bg-card border border-stone-200 rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-stone-200">
                    <div className="flex items-center gap-3">
                        <User size={20} className="text-ember-500" />
                        <h2 className="font-body text-sm uppercase tracking-widest text-ink">Character Bank</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-stone-100 rounded text-stone-400 hover:text-stone-700 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Add new character button */}
                    {!isAdding && !editingId && (
                        <button
                            onClick={handleStartAdd}
                            className="w-full py-3 border-2 border-dashed border-stone-200 rounded text-stone-500 hover:text-ink hover:border-stone-400 hover:bg-stone-50 transition-colors flex items-center justify-center gap-2 font-body text-sm"
                        >
                            <Plus size={16} />
                            Add New Character
                        </button>
                    )}

                    {/* Add/Edit Form */}
                    {(isAdding || editingId) && (
                        <div className="bg-paper border border-stone-200 rounded-sm p-4 space-y-4">
                            <h3 className="font-body text-xs uppercase tracking-widest text-ember-500 mb-3">
                                {isAdding ? 'New Character' : 'Edit Character'}
                            </h3>

                            {/* Basic info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-body text-stone-600 uppercase mb-1">Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g., Elias"
                                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded text-ink text-sm placeholder:text-stone-400 focus:outline-none focus:border-stone-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-body text-stone-600 uppercase mb-1">Quick Description</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="e.g., The protagonist"
                                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded text-ink text-sm placeholder:text-stone-400 focus:outline-none focus:border-stone-400"
                                    />
                                </div>
                            </div>

                            {/* Appearance fields */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-body text-stone-600 uppercase">Physical Appearance</p>
                                
                                <div className="grid grid-cols-3 gap-3">
                                    <AppearanceField label="Age" value={formData.appearance.age || ''} onChange={(v) => updateAppearance('age', v)} placeholder="e.g., mid-20s" />
                                    <AppearanceField label="Gender" value={formData.appearance.gender || ''} onChange={(v) => updateAppearance('gender', v)} placeholder="e.g., male" />
                                    <AppearanceField label="Ethnicity" value={formData.appearance.ethnicity || ''} onChange={(v) => updateAppearance('ethnicity', v)} placeholder="e.g., East Asian" />
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <AppearanceField label="Height" value={formData.appearance.height || ''} onChange={(v) => updateAppearance('height', v)} placeholder="e.g., tall" />
                                    <AppearanceField label="Build" value={formData.appearance.build || ''} onChange={(v) => updateAppearance('build', v)} placeholder="e.g., skinny" />
                                    <AppearanceField label="Skin Tone" value={formData.appearance.skinTone || ''} onChange={(v) => updateAppearance('skinTone', v)} placeholder="e.g., olive" />
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <AppearanceField label="Hair Color" value={formData.appearance.hairColor || ''} onChange={(v) => updateAppearance('hairColor', v)} placeholder="e.g., red" />
                                    <AppearanceField label="Hair Style" value={formData.appearance.hairStyle || ''} onChange={(v) => updateAppearance('hairStyle', v)} placeholder="e.g., messy, short" />
                                    <AppearanceField label="Eye Color" value={formData.appearance.eyeColor || ''} onChange={(v) => updateAppearance('eyeColor', v)} placeholder="e.g., green" />
                                </div>

                                <AppearanceField label="Facial Features" value={formData.appearance.facialFeatures || ''} onChange={(v) => updateAppearance('facialFeatures', v)} placeholder="e.g., sharp jawline, freckles, scar on left cheek" />
                                <AppearanceField label="Distinguishing Marks" value={formData.appearance.distinguishingMarks || ''} onChange={(v) => updateAppearance('distinguishingMarks', v)} placeholder="e.g., tattoo on forearm, birthmark" />
                                <AppearanceField label="Typical Clothing" value={formData.appearance.clothing || ''} onChange={(v) => updateAppearance('clothing', v)} placeholder="e.g., worn leather jacket, dark jeans" />
                                <AppearanceField label="Accessories" value={formData.appearance.accessories || ''} onChange={(v) => updateAppearance('accessories', v)} placeholder="e.g., silver ring, glasses" />
                                <AppearanceField label="Additional Notes" value={formData.appearance.additionalNotes || ''} onChange={(v) => updateAppearance('additionalNotes', v)} placeholder="e.g., always looks tired, nervous energy" />
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={handleCancel}
                                    className="px-4 py-2 text-stone-600 hover:text-stone-800 font-body text-xs uppercase tracking-widest transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!formData.name.trim()}
                                    className="flex-1 py-2 bg-ink hover:bg-stone-800 text-white rounded font-body text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    <Save size={14} />
                                    Save Character
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Character list */}
                    {characters.length === 0 && !isAdding ? (
                        <div className="py-4">
                            <EmptyState
                                variant="characters"
                                onAction={handleStartAdd}
                                actionLabel="Add First Character"
                            />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {characters.map(char => (
                                <div 
                                    key={char.id} 
                                    className={`bg-card border rounded-sm overflow-hidden transition-colors ${
                                        editingId === char.id ? 'border-stone-400' : 'border-stone-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 p-3">
                                        <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-ember-500 font-bold text-lg">
                                            {char.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-ink truncate">{char.name}</p>
                                            <p className="text-xs text-stone-500 truncate">{char.description || 'No description'}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setExpandedId(expandedId === char.id ? null : char.id)}
                                                className="p-2 text-stone-500 hover:text-stone-700 transition-colors"
                                                title="View details"
                                            >
                                                {expandedId === char.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                            <button
                                                onClick={() => handleStartEdit(char)}
                                                className="p-2 text-stone-500 hover:text-ember-500 transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(char.id)}
                                                className="p-2 text-stone-500 hover:text-red-500 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded appearance details */}
                                    {expandedId === char.id && char.appearance && (
                                        <div className="px-3 pb-3 pt-0">
                                            <div className="bg-paper rounded-lg p-3 text-xs space-y-1">
                                                <p className="font-body text-[10px] text-stone-500 uppercase mb-2">Appearance Details</p>
                                                {char.appearance.age && <DetailRow label="Age" value={char.appearance.age} />}
                                                {char.appearance.gender && <DetailRow label="Gender" value={char.appearance.gender} />}
                                                {char.appearance.ethnicity && <DetailRow label="Ethnicity" value={char.appearance.ethnicity} />}
                                                {char.appearance.height && <DetailRow label="Height" value={char.appearance.height} />}
                                                {char.appearance.build && <DetailRow label="Build" value={char.appearance.build} />}
                                                {char.appearance.skinTone && <DetailRow label="Skin Tone" value={char.appearance.skinTone} />}
                                                {char.appearance.hairColor && <DetailRow label="Hair Color" value={char.appearance.hairColor} />}
                                                {char.appearance.hairStyle && <DetailRow label="Hair Style" value={char.appearance.hairStyle} />}
                                                {char.appearance.eyeColor && <DetailRow label="Eye Color" value={char.appearance.eyeColor} />}
                                                {char.appearance.facialFeatures && <DetailRow label="Facial Features" value={char.appearance.facialFeatures} />}
                                                {char.appearance.distinguishingMarks && <DetailRow label="Marks" value={char.appearance.distinguishingMarks} />}
                                                {char.appearance.clothing && <DetailRow label="Clothing" value={char.appearance.clothing} />}
                                                {char.appearance.accessories && <DetailRow label="Accessories" value={char.appearance.accessories} />}
                                                {char.appearance.additionalNotes && <DetailRow label="Notes" value={char.appearance.additionalNotes} />}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-stone-200">
                    <p className="text-[10px] text-stone-500 font-body text-center">
                        {characters.length} character{characters.length !== 1 ? 's' : ''} • Character appearances are included in image generation prompts
                    </p>
                </div>
            </div>
        </div>
    );
}

function AppearanceField({ label, value, onChange, placeholder }: { 
    label: string; 
    value: string; 
    onChange: (v: string) => void;
    placeholder: string;
}) {
    return (
        <div>
            <label className="block text-[10px] font-body text-stone-500 uppercase mb-1">{label}</label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-2 py-1.5 bg-white border border-stone-200 rounded text-ink text-xs placeholder:text-stone-400 focus:outline-none focus:border-ember-500"
            />
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex">
            <span className="text-stone-500 w-24 flex-shrink-0">{label}:</span>
            <span className="text-ink">{value}</span>
        </div>
    );
}

// Helper to build a description from appearance fields
function buildDescriptionFromAppearance(appearance: NonNullable<Character['appearance']>): string {
    const parts: string[] = [];
    
    if (appearance.age) parts.push(appearance.age);
    if (appearance.gender) parts.push(appearance.gender);
    if (appearance.ethnicity) parts.push(appearance.ethnicity);
    if (appearance.build) parts.push(appearance.build);
    if (appearance.height) parts.push(appearance.height);
    if (appearance.hairColor && appearance.hairStyle) {
        parts.push(`${appearance.hairColor} ${appearance.hairStyle} hair`);
    } else if (appearance.hairColor) {
        parts.push(`${appearance.hairColor} hair`);
    } else if (appearance.hairStyle) {
        parts.push(`${appearance.hairStyle} hair`);
    }
    if (appearance.eyeColor) parts.push(`${appearance.eyeColor} eyes`);
    
    return parts.join(', ');
}

export default CharacterBank;
