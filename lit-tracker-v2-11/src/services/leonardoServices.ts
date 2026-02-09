import { AspectRatio } from "../types";

// Leonardo Phoenix model ID
const PHOENIX_MODEL_ID = "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3";

// Map aspect ratios to Leonardo dimensions
function getImageDimensions(aspectRatio: AspectRatio | string): { width: number; height: number } {
    const ratio = String(aspectRatio).toLowerCase();
    switch (ratio) {
        case 'wide':
            return { width: 1472, height: 832 };
        case 'std':
            return { width: 1360, height: 1024 };
        case 'tall':
            return { width: 1024, height: 1360 };
        case 'portrait':
            return { width: 832, height: 1472 };
        case 'square':
        default:
            return { width: 1024, height: 1024 };
    }
}

interface LeonardoGenerationResponse {
    sdGenerationJob: {
        generationId: string;
    };
}

interface LeonardoStatusResponse {
    generations_by_pk: {
        status: 'PENDING' | 'COMPLETE' | 'FAILED';
        generated_images: Array<{
            url: string;
            id: string;
        }>;
    };
}

export async function generateLeonardoImage(
    prompt: string,
    aspectRatio: AspectRatio | string,
    apiKey: string,
    initImage?: string,
    strength: number = 0.7
): Promise<string> {
    if (!apiKey?.trim()) {
        throw new Error('Leonardo API key is missing or empty.');
    }

    const { width, height } = getImageDimensions(aspectRatio);

    try {
        const body: Record<string, unknown> = {
            modelId: PHOENIX_MODEL_ID,
            prompt,
            num_images: 1,
            width,
            height,
            alchemy: true,
            contrast: 3.5,
            enhancePrompt: false,
            public: false,
        };

        const createRes = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`,
                                      'Content-Type': 'application/json',
                                      'Accept': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!createRes.ok) {
            const rawText = await createRes.text();
            let msg = rawText;
            try {
                const errJson = JSON.parse(rawText);
                msg = errJson.error || errJson.message || rawText;
            } catch {}
            throw new Error(`Leonardo API error ${createRes.status}: ${msg}`);
        }

        const createData: LeonardoGenerationResponse = await createRes.json();
        const generationId = createData.sdGenerationJob?.generationId;

        if (!generationId) {
            throw new Error('No generation ID returned from Leonardo API.');
        }

        const imageUrl = await pollForCompletion(apiKey, generationId);
        return imageUrl;

    } catch (error: unknown) {
        console.error('Leonardo generation failed:', error);
        throw error;
    }
}

async function pollForCompletion(
    apiKey: string,
    generationId: string,
    maxAttempts: number = 60,
    intervalMs: number = 2000
): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await sleep(intervalMs);

        const res = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`,
                                'Accept': 'application/json',
            },
        });

        if (!res.ok) {
            const rawText = await res.text();
            throw new Error(`Leonardo status check failed ${res.status}: ${rawText}`);
        }

        const data: LeonardoStatusResponse = await res.json();
        const status = data.generations_by_pk?.status;

        if (status === 'COMPLETE') {
            const images = data.generations_by_pk?.generated_images;
            if (images && images.length > 0) {
                return images[0].url;
            }
            throw new Error('Generation complete but no images returned.');
        }

        if (status === 'FAILED') {
            throw new Error('Leonardo generation failed.');
        }
    }

    throw new Error('Leonardo generation timed out after 2 minutes.');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
