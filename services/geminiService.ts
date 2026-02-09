import { GoogleGenAI } from "@google/genai";

/**
 * Generates an image using Google Gemini's image generation model.
 * @param prompt - The text prompt for image generation
 * @param aspectRatio - The desired aspect ratio (e.g., "16:9", "1:1")
 * @param apiKey - The Gemini API key (BYOK - Bring Your Own Key)
 * @param initImage - Optional base64 image for img2img editing
 * @param strength - Strength of transformation for img2img (0-1)
 */
export const generateImage = async (
    prompt: string,
    aspectRatio: string,
    apiKey: string,
    initImage?: string,
    strength: number = 0.7
): Promise<string | undefined> => {
    if (!apiKey?.trim()) {
        throw new Error('Gemini API key is missing or empty. Please enter your API key in the sidebar.');
    }

    if (initImage) {
        // If an initial image is provided, we use the editImage logic which acts as img2img
        return editImage(initImage, prompt, apiKey, strength);
    }

    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp-image-generation',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                responseModalities: ['Text', 'Image'],
            } as any
        });

        // Fix: Iterate through all parts to find the image part as response may contain mixed modalities
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
    } catch (error) {
        console.error("Gemini image generation failed:", error);
        throw error;
    }
    return undefined;
};

/**
 * Edits an existing image using Gemini's vision + generation capabilities.
 */
export const editImage = async (
    base64Data: string,
    editPrompt: string,
    apiKey: string,
    strength: number = 0.7
): Promise<string | undefined> => {
    if (!apiKey?.trim()) {
        throw new Error('Gemini API key is missing or empty.');
    }

    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    // Strip data:image/png;base64, prefix
    const base64 = base64Data.split(',')[1] || base64Data;

    // Since Gemini uses vision + text for editing,
    // we use the strength value to modulate the prompt instructions for consistency.
    const influence = strength > 0.75
        ? "Maintain the original composition and character details very strictly."
        : strength < 0.4
        ? "Be very creative and transformative, deviating significantly from the reference structure."
        : "Maintain character consistency and general scene structure.";

    const finalPrompt = `${editPrompt}. ${influence}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp-image-generation',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64,
                            mimeType: 'image/png'
                        }
                    },
                    { text: finalPrompt }
                ]
            },
            config: {
                responseModalities: ['Text', 'Image'],
            } as any
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
    } catch (error) {
        console.error("Gemini image editing failed:", error);
        throw error;
    }
    return undefined;
};

/**
 * Uses Gemini to improve a prompt for better image generation results.
 */
export const improvePrompt = async (rawPrompt: string, apiKey: string): Promise<string> => {
    if (!apiKey?.trim()) {
        return rawPrompt;
    }

    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `Improve the following storyboard panel prompt for better image generation. Be descriptive and vivid. Keep it concise. Prompt: ${rawPrompt}`,
        });
        return response.text || rawPrompt;
    } catch (error) {
        return rawPrompt;
    }
};
