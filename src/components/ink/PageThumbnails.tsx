import { useState, useEffect } from 'react';
import { getImage } from '../../services/imageStorage';
import { Panel } from '../../types';

interface PageThumbnailsProps {
    panels: Panel[];
}

const MAX_THUMBNAILS = 6;
const THUMBNAIL_SIZE = 24;

export function PageThumbnails({ panels }: PageThumbnailsProps) {
    const [thumbnailUrls, setThumbnailUrls] = useState<(string | null)[]>([]);

    useEffect(() => {
        let mounted = true;
        
        // Load images asynchronously to avoid blocking UI
        const loadThumbnails = async () => {
            const urls = await Promise.all(
                panels.slice(0, MAX_THUMBNAILS).map(async (panel) => {
                    if (!panel.imageUrl) {
                        return null;
                    }
                    
                    // Handle IndexedDB URLs
                    if (panel.imageUrl.startsWith('idb://')) {
                        const panelId = panel.imageUrl.replace('idb://', '');
                        try {
                            const dataUrl = await getImage(panelId);
                            return dataUrl;
                        } catch (error) {
                            console.error('Error loading thumbnail:', error);
                            return null;
                        }
                    }
                    
                    // For regular URLs (http/https/data:), return as-is
                    return panel.imageUrl;
                })
            );
            
            // Only update state if component is still mounted
            if (mounted) {
                setThumbnailUrls(urls);
            }
        };

        loadThumbnails();
        
        return () => {
            mounted = false;
        };
    }, [panels]);

    const visiblePanels = panels.slice(0, MAX_THUMBNAILS);
    const remainingCount = Math.max(0, panels.length - MAX_THUMBNAILS);

    return (
        <div className="flex items-center gap-1 mt-1">
            {visiblePanels.map((panel, index) => {
                const thumbnailUrl = thumbnailUrls[index];
                
                return (
                    <div
                        key={panel.id}
                        className="border border-stone-200 bg-card rounded"
                        style={{
                            width: `${THUMBNAIL_SIZE}px`,
                            height: `${THUMBNAIL_SIZE}px`,
                            minWidth: `${THUMBNAIL_SIZE}px`,
                            minHeight: `${THUMBNAIL_SIZE}px`,
                        }}
                    >
                        {thumbnailUrl ? (
                            <img
                                src={thumbnailUrl}
                                alt={`Panel ${index + 1}`}
                                className="w-full h-full object-cover rounded"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-full h-full bg-card" />
                        )}
                    </div>
                );
            })}
            {remainingCount > 0 && (
                <span className="text-[9px] font-body text-stone-400 ml-1">
                    +{remainingCount}
                </span>
            )}
        </div>
    );
}
