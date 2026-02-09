import { AspectRatio } from "../types";

/**
 * Generates an image using SeaArt.ai API.
 * SeaArt offers more flexibility for creative/mature content.
 */

// Map aspect ratios to SeaArt dimensions
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

interface SeaArtCreateResponse {
    data?: {
        task_id?: string;
    };
    error?: string;
    msg?: string;
}

interface SeaArtStatusResponse {
    data?: {
        status?: number; // 1=pending, 2=processing, 3=success, 4=failed
        items?: Array<{
            img_url?: string;
        }>;
    };
    error?: string;
    msg?: string;
}

/**
 * Generates an image using SeaArt.ai API.
 * @param prompt - The text prompt for image generation
 * @param aspectRatio - The desired aspect ratio
 * @param apiKey - The SeaArt API key (BYOK)
 * @param initImage - Optional base64 image for img2img
 * @param strength - Strength of transformation for img2img (0-1)
 */
export async function generateSeaArtImage(
    prompt: string,
    aspectRatio: AspectRatio | string,
    apiKey: string,
    initImage?: string,
    strength: number = 0.7
): Promise<string> {
    if (!apiKey?.trim()) {
        throw new Error('SeaArt API key is missing or empty. Please enter your API key in the sidebar.');
    }

    const { width, height } = getImageDimensions(aspectRatio);

    try {
        // Create generation task
        const createBody: Record<string, unknown> = {
            prompt: prompt.trim(),
            negative_prompt: "blurry, low quality, distorted",
            width,
            height,
            num: 1,
            guidance: 7,
            steps: 30,
        };

        // Add init image for img2img if provided
        if (initImage) {
            // Strip data URL prefix if present
            const base64Data = initImage.includes(',') ? initImage.split(',')[1] : initImage;
            createBody.init_image = base64Data;
            createBody.strength = strength;
        }

        const createResponse = await fetch('https://www.seaart.ai/api/v1/task/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(createBody),
        });

        if (!createResponse.ok) {
            const rawText = await createResponse.text();
            let msg = rawText;
            try {
                const errJson = JSON.parse(rawText);
                msg = errJson.msg || errJson.error || rawText;
            } catch {}
            throw new Error(`SeaArt API error ${createResponse.status}: ${msg}`);
        }

        const createData: SeaArtCreateResponse = await createResponse.json();

        if (createData.error || !createData.data?.task_id) {
            throw new Error(`SeaArt API error: ${createData.msg || createData.error || 'No task ID returned'}`);
        }

        const taskId = createData.data.task_id;

        // Poll for completion
        const imageUrl = await pollForCompletion(apiKey, taskId);
        return imageUrl;

    } catch (error: any) {
        console.error('SeaArt image generation failed:', error);
        throw error;
    }
}

async function pollForCompletion(
    apiKey: string,
    taskId: string,
    maxAttempts: number = 60,
    intervalMs: number = 2000
): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await sleep(intervalMs);

        const response = await fetch(`https://www.seaart.ai/api/v1/task/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            const rawText = await response.text();
            throw new Error(`SeaArt status check failed ${response.status}: ${rawText}`);
        }

        const data: SeaArtStatusResponse = await response.json();
        const status = data.data?.status;

        // Status: 1=pending, 2=processing, 3=success, 4=failed
        if (status === 3) {
            const images = data.data?.items;
            if (images && images.length > 0 && images[0].img_url) {
                return images[0].img_url;
            }
            throw new Error('Generation complete but no image URL returned.');
        }

        if (status === 4) {
            throw new Error('SeaArt generation failed.');
        }
    }

    throw new Error('SeaArt generation timed out after 2 minutes.');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
