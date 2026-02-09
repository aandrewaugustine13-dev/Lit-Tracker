import { AspectRatio } from "../types";

/**
 * Generates an image using fal.ai's Flux models.
 */
export async function generateFluxImage(
    prompt: string,
    aspectRatio: AspectRatio | string,
    apiKey: string,
    model: string = 'fal-ai/flux-pro',
    initImage?: string,
    strength: number = 0.7
): Promise<string> {
    if (!apiKey?.trim()) {
        throw new Error('fal.ai API key is missing or empty.');
    }

    const ratio = String(aspectRatio).toLowerCase();
    let image_size: string = 'square_hd';

    if (ratio === 'wide') image_size = 'landscape_16_9';
    else if (ratio === 'std') image_size = 'landscape_4_3';
    else if (ratio === 'tall') image_size = 'portrait_4_3';
    else if (ratio === 'portrait') image_size = 'portrait_16_9';

    const isImg2Img = !!initImage;
    // Use specialized endpoint for i2i if needed, or stick to provided model
    const endpoint = isImg2Img ? 'fal-ai/flux/dev/image-to-image' : model;

    try {
        const body: any = {
            prompt,
            num_images: 1,
            enable_safety_checker: true,
            sync_mode: true
        };

        if (isImg2Img && initImage) {
            body.image_url = initImage;
            body.strength = strength;
        } else {
            body.image_size = image_size;
        }

        const res = await fetch(`https://fal.run/${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${apiKey.trim()}`,
                                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const rawText = await res.text();
            let msg = rawText;
            try {
                const errJson = JSON.parse(rawText);
                msg = errJson.detail || errJson.message || rawText;
            } catch {}
            throw new Error(`fal.ai error ${res.status}: ${msg}`);
        }

        const data = await res.json();
        const url = data?.images?.[0]?.url;

        if (!url) {
            throw new Error('No image URL returned from fal.ai response.');
        }

        return url;
    } catch (error: any) {
        console.error('fal.ai generation failed:', error);
        throw error;
    }
}
