import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Play, Pause } from 'lucide-react';
import { Issue, Panel, TextElement, TextElementType, TextOverlayStyle } from '../../types';
import { getImage } from '../../services/imageStorage';

interface PresentModeProps {
  issue: Issue;
  onClose: () => void;
  textOverlayStyle?: TextOverlayStyle;
}

/** Flat representation of a panel with its page context */
interface FlatPanel {
  panel: Panel;
  pageNumber: number;
  panelIndexInPage: number;
  totalPanelsInPage: number;
}

/**
 * Build a flat array of all panels across all pages in the issue,
 * sorted by page number, preserving panel order within each page.
 */
function getAllPanels(issue: Issue): FlatPanel[] {
  const result: FlatPanel[] = [];
  // Use slice() to avoid mutating the original pages array
  const sortedPages = [...issue.pages].sort((a, b) => a.number - b.number);
  for (const page of sortedPages) {
    page.panels.forEach((panel, idx) => {
      result.push({
        panel,
        pageNumber: page.number,
        panelIndexInPage: idx + 1,
        totalPanelsInPage: page.panels.length,
      });
    });
  }
  return result;
}

/**
 * PresentMode — Full-screen cinematic presentation/read-through mode.
 *
 * Features:
 * - Cross-page navigation (flat panel list across all pages)
 * - Crossfade transitions (~300ms)
 * - Script/prompt text overlay (toggle with T key)
 * - Auto-advance with play/pause (space toggles, configurable delay)
 * - Page interstitial when crossing page boundaries
 * - Auto-hiding control bar
 * - Keyboard: arrows navigate, space toggles auto-play, T toggles text, Escape exits
 */
const PresentMode: React.FC<PresentModeProps> = ({ issue, onClose, textOverlayStyle = 'opaque' }) => {
  const allPanels = React.useMemo(() => getAllPanels(issue), [issue]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTextOverlay, setShowTextOverlay] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [autoAdvanceDelay, setAutoAdvanceDelay] = useState(3);
  const [showControls, setShowControls] = useState(true);
  const [showPageInterstitial, setShowPageInterstitial] = useState(false);
  const [interstitialPageNumber, setInterstitialPageNumber] = useState(1);

  // Crossfade state
  const [fadeKey, setFadeKey] = useState(0);
  const [visible, setVisible] = useState(true);

  // Track mouse movement for auto-hide controls
  const lastMouseMove = useRef(Date.now());
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Navigation ---

  const navigateNext = useCallback(() => {
    if (showPageInterstitial) return;
    const nextIndex = currentIndex + 1;
    if (nextIndex >= allPanels.length) return;

    const currentPageNum = allPanels[currentIndex]?.pageNumber;
    const nextPageNum = allPanels[nextIndex].pageNumber;

    // Crossfade out
    setVisible(false);

    if (currentPageNum !== nextPageNum && currentIndex > 0) {
      // Show page interstitial for page boundary
      setTimeout(() => {
        setShowPageInterstitial(true);
        setInterstitialPageNumber(nextPageNum);
        setTimeout(() => {
          setShowPageInterstitial(false);
          setCurrentIndex(nextIndex);
          setFadeKey(prev => prev + 1);
          // Fade in after a tiny delay to let the new image mount
          requestAnimationFrame(() => setVisible(true));
        }, 700);
      }, 300); // wait for fade-out
    } else {
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setFadeKey(prev => prev + 1);
        requestAnimationFrame(() => setVisible(true));
      }, 300);
    }
  }, [currentIndex, allPanels, showPageInterstitial]);

  const navigatePrev = useCallback(() => {
    if (showPageInterstitial) return;
    const prevIndex = currentIndex - 1;
    if (prevIndex < 0) return;

    setVisible(false);
    setTimeout(() => {
      setCurrentIndex(prevIndex);
      setFadeKey(prev => prev + 1);
      requestAnimationFrame(() => setVisible(true));
    }, 300);
  }, [currentIndex, showPageInterstitial]);

  // --- Keyboard handling ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          navigatePrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          navigateNext();
          break;
        case ' ':
          e.preventDefault();
          e.stopPropagation();
          setAutoAdvance(prev => !prev);
          break;
        case 't':
        case 'T':
          e.preventDefault();
          e.stopPropagation();
          setShowTextOverlay(prev => !prev);
          break;
      }
    };

    // Use capture phase to intercept before App.tsx's handler
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, navigateNext, navigatePrev]);

  // --- Auto-advance timer ---

  useEffect(() => {
    if (!autoAdvance || showPageInterstitial) return;

    const timer = setTimeout(() => {
      navigateNext();
    }, autoAdvanceDelay * 1000);

    return () => clearTimeout(timer);
  }, [autoAdvance, autoAdvanceDelay, currentIndex, showPageInterstitial, navigateNext]);

  // --- Mouse move detection for control bar auto-hide ---

  useEffect(() => {
    const handleMouseMove = () => {
      lastMouseMove.current = Date.now();
      setShowControls(true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Auto-hide controls after 3 seconds of no mouse movement
  useEffect(() => {
    const tick = () => {
      const timeSinceMove = Date.now() - lastMouseMove.current;
      if (timeSinceMove >= 3000) {
        setShowControls(false);
      }
      controlsTimerRef.current = setTimeout(tick, 1000);
    };
    controlsTimerRef.current = setTimeout(tick, 3000);
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // --- Render ---

  if (allPanels.length === 0) {
    return (
      <div className="fixed inset-0 bg-paper z-[9999] flex items-center justify-center">
        <p className="text-stone-600 font-body text-lg">No panels to present.</p>
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-3 bg-card hover:bg-stone-100 rounded-full text-ink transition-colors border border-stone-200"
        >
          <X size={24} />
        </button>
      </div>
    );
  }

  const currentPanelData = allPanels[currentIndex];
  if (!currentPanelData) return null;

  const { panel, pageNumber, panelIndexInPage, totalPanelsInPage } = currentPanelData;
  const totalPanelCount = allPanels.length;
  const progressPercent =
    totalPanelCount <= 1 ? 100 : (currentIndex / (totalPanelCount - 1)) * 100;

  return (
    <div
      className="fixed inset-0 bg-paper z-[9999] flex items-center justify-center select-none"
      style={{ isolation: 'isolate' }}
    >
      {/* Exit button (always visible) */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-3 bg-card hover:bg-stone-100 rounded-full text-ink transition-colors z-[10001] border border-stone-200"
        title="Exit presentation (Escape)"
      >
        <X size={24} />
      </button>

      {/* Page interstitial */}
      {showPageInterstitial && (
        <div className="absolute inset-0 flex items-center justify-center z-[10000] bg-paper animate-fade-in">
          <div className="text-center">
            <p className="text-stone-500 text-sm font-body uppercase tracking-widest mb-2">
              Turning to
            </p>
            <p className="text-ink text-5xl font-display tracking-wider">
              Page {interstitialPageNumber}
            </p>
          </div>
        </div>
      )}

      {/* Main panel display with crossfade */}
      {!showPageInterstitial && (
        <div
          key={fadeKey}
          className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center cursor-pointer"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 300ms ease-in-out',
          }}
          onClick={navigateNext}
        >
          <div className="relative">
            <PresentPanel
              panelId={panel.id}
              imageUrl={panel.imageUrl}
              prompt={panel.prompt}
            />

            {/* Text element overlays - speech bubbles etc */}
            {panel.imageUrl &&
              panel.textElements &&
              panel.textElements.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {panel.textElements.map((te) => (
                    <PresentTextElement key={te.id} element={te} textOverlayStyle={textOverlayStyle} />
                  ))}
                </div>
              )}

            {/* Script/prompt text overlay */}
            {showTextOverlay && panel.prompt && (
              <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
                <div
                  className="px-6 py-4 rounded-b-2xl"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)',
                  }}
                >
                  <p className="text-white text-sm leading-relaxed font-sans max-w-[700px]">
                    {panel.prompt}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-200 z-[10000]">
        <div
          className="h-full bg-ember-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Control bar (auto-hide) */}
      <div
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 bg-card rounded-2xl px-6 py-4 flex items-center gap-5 shadow-2xl border border-stone-200 z-[10001] transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Previous button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigatePrev();
          }}
          disabled={currentIndex === 0}
          className="p-2 hover:bg-ember-500 hover:text-paper rounded-lg text-ink transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
          title="Previous panel (←)"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Page / panel indicator */}
        <div className="flex items-center gap-3 font-body text-xs text-stone-600 min-w-[220px] justify-center">
          <span className="text-ember-500">
            Page {pageNumber} — Panel {panelIndexInPage}/{totalPanelsInPage}
          </span>
          <span className="text-stone-300">|</span>
          <span>
            {currentIndex + 1} of {totalPanelCount}
          </span>
        </div>

        {/* Next button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigateNext();
          }}
          disabled={currentIndex >= totalPanelCount - 1}
          className="p-2 hover:bg-ember-500 hover:text-paper rounded-lg text-ink transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
          title="Next panel (→)"
        >
          <ChevronRight size={22} />
        </button>

        {/* Separator */}
        <div className="h-6 w-px bg-stone-200" />

        {/* Play/Pause auto-advance */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setAutoAdvance((prev) => !prev);
          }}
          className={`p-2 rounded-lg transition-colors ${
            autoAdvance
              ? 'bg-ember-500 text-paper hover:bg-ember-400'
              : 'text-ink hover:bg-stone-100 hover:text-ink'
          }`}
          title={autoAdvance ? 'Pause auto-advance (Space)' : 'Play auto-advance (Space)'}
        >
          {autoAdvance ? <Pause size={18} /> : <Play size={18} />}
        </button>

        {/* Delay input */}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="1"
            max="15"
            value={autoAdvanceDelay}
            onChange={(e) =>
              setAutoAdvanceDelay(
                Math.max(1, Math.min(15, parseInt(e.target.value) || 3))
              )
            }
            onClick={(e) => e.stopPropagation()}
            className="w-12 px-2 py-1 bg-paper border border-stone-200 rounded text-ink text-xs font-body text-center focus:outline-none focus:border-ember-500"
          />
          <span className="font-body text-xs text-stone-500">s</span>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-stone-200" />

        {/* Text overlay toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowTextOverlay((prev) => !prev);
          }}
          className={`px-3 py-1.5 rounded-lg font-body text-xs transition-colors ${
            showTextOverlay
              ? 'bg-ember-500 text-paper hover:bg-ember-400'
              : 'text-stone-600 hover:bg-stone-100 hover:text-ink'
          }`}
          title="Toggle script text overlay (T)"
        >
          TXT
        </button>
      </div>
    </div>
  );
};

export default PresentMode;

// --- Helper sub-components ---

/**
 * Loads and displays a panel image from IndexedDB or direct URL.
 * Shows prompt text as placeholder if no image is available.
 */
function PresentPanel({
  panelId,
  imageUrl,
  prompt,
}: {
  panelId: string;
  imageUrl?: string;
  prompt?: string;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setImage(null);

    if (!imageUrl) {
      setLoading(false);
      return;
    }

    if (imageUrl.startsWith('data:') || imageUrl.startsWith('http')) {
      setImage(imageUrl);
      setLoading(false);
    } else if (imageUrl.startsWith('idb://')) {
      const id = imageUrl.replace('idb://', '');
      getImage(id).then((data) => {
        if (data) setImage(data);
        setLoading(false);
      });
    } else {
      // Try loading as idb key directly
      getImage(imageUrl).then((data) => {
        if (data) setImage(data);
        setLoading(false);
      });
    }
  }, [imageUrl, panelId]);

  if (loading) {
    return (
      <div className="w-[800px] h-[500px] bg-card rounded-2xl flex items-center justify-center border border-stone-200">
        <div className="w-8 h-8 border-2 border-ember-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!image) {
    return (
      <div className="w-[800px] h-[500px] bg-card rounded-2xl flex items-center justify-center p-8 border border-stone-200">
        <p className="text-stone-600 font-body text-sm text-center max-w-[600px]">
          {prompt || 'No image generated'}
        </p>
      </div>
    );
  }

  return (
    <img
      src={image}
      alt=""
      className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl"
      draggable={false}
    />
  );
}

/**
 * Renders a text element (speech bubble, caption, etc.) in presentation mode.
 */
function PresentTextElement({ element, textOverlayStyle = 'opaque' }: { element: TextElement; textOverlayStyle?: TextOverlayStyle }) {
  const typeClasses: Record<TextElementType, string> = {
    dialogue: 'bubble-dialogue',
    thought: 'bubble-thought',
    caption: 'bubble-caption',
    phone: 'bubble-phone',
  };

  const styleModifier = textOverlayStyle === 'semi-transparent' ? 'text-style-semi-transparent'
    : textOverlayStyle === 'border-only' ? 'text-style-border-only'
    : '';

  return (
    <div
      className={`absolute ${typeClasses[element.type]} ${styleModifier} pointer-events-none`}
      style={{
        left: `${element.x}%`,
        top: `${element.y}%`,
        fontSize: `${element.fontSize}px`,
        color: element.color,
        padding: '8px 12px',
        fontFamily: "'Comic Sans MS', 'Chalkboard', sans-serif",
        textAlign: 'center',
        lineHeight: 1.2,
        minWidth: '40px',
        maxWidth: '85%',
        transform: `rotate(${element.rotation || 0}deg)`,
      }}
    >
      {element.content}
    </div>
  );
}
