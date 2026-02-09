import { AspectRatio } from "../types";

/**
 * Generates an image using xAI's Grok image generation API.
 * Uses the grok-2-image model for image generation.
 */

// Map aspect ratios to dimensions for Grok
function getImageDimensions(aspectRatio: AspectRatio | string): { width: number; height: number } {
    const ratio = String(aspectRatio).toLowerCase();
    switch (ratio) {
        case 'wide':
            return { width: 1344, height: 768 };
        case 'std':
            return { width: 1152, height: 896 };
        case 'tall':
            return { width: 896, height: 1152 };
        case 'portrait':
            return { width: 768, height: 1344 };
        case 'square':
        default:
            return { width: 1024, height: 1024 };
    }
}

interface GrokImageResponse {
    data?: Array<{
        url?: string;
        b64_json?: string;
    }>;
    error?: {
        message: string;
    };
}

/**
 * Generates an image using xAI's Grok-2-image model.
 * @param prompt - The text prompt for image generation
 * @param aspectRatio - The desired aspect ratio
 * @param apiKey - The xAI API key (BYOK)
 * @param initImage - Optional base64 image for reference (not fully supported yet)
 * @param strength - Strength parameter (reserved for future img2img support)
 */
export async function generateGrokImage(
    prompt: string,
    aspectRatio: AspectRatio | string,
    apiKey: string,
    initImage?: string,
    strength: number = 0.7
): Promise<string> {
    if (!apiKey?.trim()) {
        throw new Error('Grok (xAI) API key is missing or empty. Please enter your API key in the sidebar.');
    }

    const { width, height } = getImageDimensions(aspectRatio);

    try {
        // xAI uses an OpenAI-compatible API format
        const response = await fetch('https://api.x.ai/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'grok-2-image',
                prompt: prompt.trim(),
                n: 1,
                size: `${width}x${height}`,
                response_format: 'url',
            }),
        });

        if (!response.ok) {
            const rawText = await response.text();
            let msg = rawText;
            try {
                const errJson = JSON.parse(rawText);
                msg = errJson.error?.message || errJson.message || rawText;
            } catch {}
            throw new Error(`Grok API error ${response.status}: ${msg}`);
        }

        const data: GrokImageResponse = await response.json();

        if (data.error) {
            throw new Error(`Grok API error: ${data.error.message}`);
        }

        const imageUrl = data.data?.[0]?.url;
        const base64Data = data.data?.[0]?.b64_json;

        if (base64Data) {
            return `data:image/png;base64,${base64Data}`;
        }

        if (!imageUrl) {
            throw new Error('No image URL returned from Grok API.');
        }

        return imageUrl;
    } catch (error: any) {
        console.error('Grok image generation failed:', error);
        throw error;
    }
}
