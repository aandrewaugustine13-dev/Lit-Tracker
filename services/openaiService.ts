import { AspectRatio } from "../types";

/**
 * Generates an image using OpenAI's GPT Image API.
 * Uses the gpt-image-1 model for image generation.
 */

// Map aspect ratios to OpenAI supported sizes
function getImageSize(aspectRatio: AspectRatio | string): string {
    const ratio = String(aspectRatio).toLowerCase();
    switch (ratio) {
        case 'wide':
            return '1536x1024';
        case 'tall':
        case 'portrait':
            return '1024x1536';
        case 'std':
        case 'square':
        default:
            return '1024x1024';
    }
}

interface OpenAIImageResponse {
    data?: Array<{
        b64_json?: string;
    }>;
    error?: {
        message: string;
        type?: string;
        code?: string;
    };
}

/**
 * Generates an image using OpenAI's gpt-image-1 model.
 * @param prompt - The text prompt for image generation
 * @param aspectRatio - The desired aspect ratio
 * @param apiKey - The OpenAI API key (BYOK)
 * @param initImage - Optional base64 image for reference (reserved for future img2img)
 * @param strength - Strength parameter (reserved for future img2img support)
 */
export async function generateOpenAIImage(
    prompt: string,
    aspectRatio: AspectRatio | string,
    apiKey: string,
    initImage?: string,
    strength?: number
): Promise<string> {
    if (!apiKey?.trim()) {
        throw new Error('OpenAI API key is missing or empty. Please enter your API key in the sidebar.');
    }

    const size = getImageSize(aspectRatio);

    try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-image-1',
                prompt: prompt.trim(),
                n: 1,
                size: size,
                quality: 'medium',
                moderation: 'low',
            }),
        });

        if (!response.ok) {
            const rawText = await response.text();
            let msg = rawText;
            try {
                const errJson = JSON.parse(rawText);
                msg = errJson.error?.message || errJson.message || rawText;
            } catch {}

            // Surface organization verification errors clearly
            if (response.status === 403 || msg.toLowerCase().includes('verification')) {
                throw new Error(
                    `OpenAI API error ${response.status}: ${msg}. ` +
                    'Note: OpenAI requires Organization Verification before using GPT Image models. ' +
                    'Please verify your organization at https://platform.openai.com/settings/organization/general'
                );
            }

            throw new Error(`OpenAI API error ${response.status}: ${msg}`);
        }

        const data: OpenAIImageResponse = await response.json();

        if (data.error) {
            throw new Error(`OpenAI API error: ${data.error.message}`);
        }

        const base64Data = data.data?.[0]?.b64_json;

        if (!base64Data) {
            throw new Error('No image data returned from OpenAI API.');
        }

        return `data:image/png;base64,${base64Data}`;
    } catch (error: any) {
        console.error('OpenAI image generation failed:', error);
        throw error;
    }
}
