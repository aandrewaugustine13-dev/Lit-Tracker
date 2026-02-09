import { AspectRatio } from "../types";

interface ReplicatePrediction {
    id: string;
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
    output?: string | string[];
    error?: string;
    urls?: {
        get: string;
    };
}

const ASPECT_RATIO_MAP: Record<string, string> = {
    [AspectRatio.WIDE]: "16:9",
    [AspectRatio.STD]: "4:3",
    [AspectRatio.SQUARE]: "1:1",
    [AspectRatio.TALL]: "3:4",
    [AspectRatio.PORTRAIT]: "9:16",
};

/**
 * Makes a direct API call to Replicate.
 * Note: Due to CORS restrictions, this may require a proxy in production.
 */
async function callReplicateAPI<T>(
    apiKey: string,
    endpoint: string,
    data?: Record<string, unknown>,
    method: string = 'POST'
): Promise<T> {
    if (!apiKey?.trim()) {
        throw new Error('Replicate API key is missing or empty.');
    }

    const baseUrl = 'https://api.replicate.com/v1';
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',
    };

    const options: RequestInit = {
        method,
        headers,
    };

    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();
    
    if (!response.ok) {
        throw new Error(result.detail || result.error || `Replicate API request failed: ${response.status}`);
    }
    
    return result as T;
}

/**
 * Generates an image using Replicate's Flux models.
 * @param prompt - The text prompt for image generation
 * @param aspectRatio - The desired aspect ratio
 * @param apiKey - The Replicate API key (BYOK)
 * @param model - The model version to use
 * @param initImage - Optional base64 image for img2img
 * @param strength - Strength of transformation for img2img (0-1)
 */
export async function generateFluxImage(
    prompt: string,
    aspectRatio: AspectRatio | string,
    apiKey: string,
    model?: string,
    initImage?: string,
    strength: number = 0.7
): Promise<string> {
    if (!apiKey?.trim()) {
        throw new Error('Replicate API key is missing or empty. Please enter your API key in the sidebar.');
    }

    const isImg2Img = !!initImage;
    const version = model || (isImg2Img
        ? "8bb04ca03d368e597c554a938c4b2b1a8d052d3a958e0a294d13e9a597a731b9"
        : "776402431718227633f81525a7a72d1a37c4f42065840d21e89f81f1856956f1");

    const replicateAspectRatio = ASPECT_RATIO_MAP[aspectRatio as AspectRatio] || "1:1";

    const input: Record<string, unknown> = {
        prompt: prompt.trim(),
        num_outputs: 1,
        output_format: "png",
        guidance_scale: 3.5,
        num_inference_steps: 28,
    };

    if (isImg2Img && initImage) {
        input.image = initImage;
        input.prompt_strength = Math.max(0.1, Math.min(1, strength));
    } else {
        input.aspect_ratio = replicateAspectRatio;
    }

    // 1. Create prediction
    const prediction = await callReplicateAPI<ReplicatePrediction>(apiKey, '/predictions', {
        version,
        input
    });

    if (prediction.error) {
        throw new Error(`Replicate Error: ${prediction.error}`);
    }

    // Check if it completed immediately (when using Prefer: wait header)
    if (prediction.status === 'succeeded' && prediction.output) {
        const output = prediction.output;
        const imageUrl = Array.isArray(output) ? output[0] : output;
        if (imageUrl && typeof imageUrl === 'string') {
            return imageUrl;
        }
    }

    const predictionId = prediction.id;

    // 2. Poll for completion
    const pollInterval = 2000;
    const maxPollTime = 180000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        const statusCheck = await callReplicateAPI<ReplicatePrediction>(
            apiKey,
            `/predictions/${predictionId}`,
            undefined,
            'GET'
        );

        if (statusCheck.status === 'succeeded') {
            const output = statusCheck.output;
            const imageUrl = Array.isArray(output) ? output[0] : output;

            if (!imageUrl || typeof imageUrl !== 'string') {
                throw new Error('Invalid image URL in response');
            }

            return imageUrl;
        } else if (statusCheck.status === 'failed' || statusCheck.status === 'canceled') {
            const errorMsg = statusCheck.error || 'Unknown error';
            throw new Error(`Generation ${statusCheck.status}: ${errorMsg}`);
        }
    }

    throw new Error('Generation timed out after 3 minutes');
}
