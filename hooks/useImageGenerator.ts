// src/hooks/useImageGenerator.ts
import { useState } from 'react';

export const useImageGenerator = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateImage = async (prompt: string, modelId?: string) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, modelId }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to generate image');
            }

            const { imageUrl } = await response.json();
            setLoading(false);
            return imageUrl;
        } catch (err) {
            setError((err as Error).message);
            setLoading(false);
            throw err;
        }
    };

    return { generateImage, loading, error };
};
