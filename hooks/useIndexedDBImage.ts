import { useState, useEffect } from 'react';
import { getImage } from '../services/imageStorage';

/**
 * A custom hook to resolve images stored in IndexedDB.
 * If the URL starts with 'idb://', it fetches the actual data URL from storage.
 */
export function useIndexedDBImage(imageUrl: string | undefined): string | undefined {
    const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(
        imageUrl?.startsWith('idb://') ? undefined : imageUrl
    );

    useEffect(() => {
        if (!imageUrl) {
            setResolvedUrl(undefined);
            return;
        }

        if (!imageUrl.startsWith('idb://')) {
            setResolvedUrl(imageUrl);
            return;
        }

        const panelId = imageUrl.replace('idb://', '');
        getImage(panelId).then(data => {
            if (data) setResolvedUrl(data);
        }).catch(err => {
            console.error("Failed to load image from IDB", err);
        });
    }, [imageUrl]);

    return resolvedUrl;
}
