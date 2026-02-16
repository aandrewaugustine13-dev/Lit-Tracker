import React, { useState, useRef, useEffect } from 'react';
import { TextElement, TextElementType, TextOverlayStyle } from '../../types';
import { InkAction as Action } from '../../store/inkSlice';
import { Icons } from '../../constants';

interface TextOverlayProps {
    element: TextElement;
    panelId: string;
    dispatch: React.Dispatch<Action>;
    textOverlayStyle?: TextOverlayStyle;
}

const TextOverlay: React.FC<TextOverlayProps> = ({ element, panelId, dispatch, textOverlayStyle = 'opaque' }) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState<'bubble' | 'tail' | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, startX: 0, startY: 0 });
    
    // Track actual bubble bounds in percentages for tail connection
    const [bubbleBounds, setBubbleBounds] = useState({ centerX: 0, centerY: 0, bottomY: 0 });

    const rotation = element.rotation || 0;
    const tailX = element.tailX ?? (element.x + 15);
    const tailY = element.tailY ?? (element.y + 25);
    const tailStyle = element.tailStyle ?? (element.type === 'thought' ? 'cloud' : 'pointy');

    // Calculate actual bubble bounds when element changes or on mount
    useEffect(() => {
        const updateBounds = () => {
            if (overlayRef.current && overlayRef.current.parentElement) {
                const parent = overlayRef.current.parentElement;
                const parentRect = parent.getBoundingClientRect();
                const bubbleRect = overlayRef.current.getBoundingClientRect();
                
                // Convert to percentage coordinates
                const centerX = ((bubbleRect.left - parentRect.left + bubbleRect.width / 2) / parentRect.width) * 100;
                const centerY = ((bubbleRect.top - parentRect.top + bubbleRect.height / 2) / parentRect.height) * 100;
                const bottomY = ((bubbleRect.top - parentRect.top + bubbleRect.height) / parentRect.height) * 100;
                
                setBubbleBounds({ centerX, centerY, bottomY });
            }
        };
        
        // Update on mount and when element position changes
        updateBounds();
        // Also update after a brief delay to catch any layout shifts
        const timer = setTimeout(updateBounds, 50);
        return () => clearTimeout(timer);
    }, [element.x, element.y, element.content, element.fontSize]);

    const handlePointerDown = (e: React.PointerEvent, target: 'bubble' | 'tail') => {
        e.stopPropagation();
        setIsDragging(target);
        setDragStart({
            x: e.clientX,
            y: e.clientY,
            startX: target === 'bubble' ? element.x : tailX,
            startY: target === 'bubble' ? element.y : tailY
        });
        const captureTarget = target === 'bubble' ? overlayRef.current : e.currentTarget;
        (captureTarget as HTMLElement)?.setPointerCapture(e.pointerId);
        setIsFocused(true);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        const parent = overlayRef.current?.parentElement;
        if (!parent) return;

        const dx = ((e.clientX - dragStart.x) / parent.clientWidth) * 100;
        const dy = ((e.clientY - dragStart.y) / parent.clientHeight) * 100;

        if (isDragging === 'bubble') {
            dispatch({
                type: 'UPDATE_TEXT_ELEMENT',
                panelId,
                elementId: element.id,
                updates: {
                    x: Math.max(0, Math.min(100 - (element.width || 0), dragStart.startX + dx)),
                     y: Math.max(0, Math.min(100 - (element.height || 0), dragStart.startY + dy))
                }
            });
        } else if (isDragging === 'tail') {
            dispatch({
                type: 'UPDATE_TEXT_ELEMENT',
                panelId,
                elementId: element.id,
                updates: {
                    tailX: Math.max(0, Math.min(100, dragStart.startX + dx)),
                     tailY: Math.max(0, Math.min(100, dragStart.startY + dy))
                }
            });
        }
    };

    const handlePointerUp = () => setIsDragging(null);

    const typeClasses: Record<TextElementType, string> = {
        dialogue: "bubble-dialogue",
        thought: "bubble-thought",
        caption: "bubble-caption",
        phone: "bubble-phone"
    };

    // Use actual bubble bounds for tail connection
    const { centerX: bubbleCenterX, centerY: bubbleCenterY, bottomY: bubbleBottomY } = bubbleBounds;
    
    // Calculate tail base point - where it connects to bubble (at the bottom edge)
    const tailBaseX = bubbleCenterX;
    const tailBaseY = bubbleBottomY;

    // Compute tail fill/stroke based on text overlay style
    const tailFill = textOverlayStyle === 'border-only' ? 'transparent'
        : textOverlayStyle === 'semi-transparent' ? 'rgba(255,255,255,0.7)'
        : 'white';
    const tailStroke = textOverlayStyle === 'semi-transparent' ? '#6b7280' : 'black';

    return (
        <>
        <svg 
            className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-[50]"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
        >
        {tailStyle !== 'none' && element.type !== 'caption' && bubbleBounds.centerX > 0 && (
            tailStyle === 'pointy' ? (
                <polygon
                points={`${tailBaseX - 2},${tailBaseY - 0.5} ${tailX},${tailY} ${tailBaseX + 2},${tailBaseY - 0.5}`}
                fill={tailFill}
                stroke={tailStroke}
                strokeWidth="0.4"
                strokeLinejoin="round"
                />
            ) : (
                <>
                <circle cx={tailBaseX + (tailX - tailBaseX) * 0.25} cy={tailBaseY + (tailY - tailBaseY) * 0.25} r="2" fill={tailFill} stroke={tailStroke} strokeWidth="0.3" />
                <circle cx={tailBaseX + (tailX - tailBaseX) * 0.5} cy={tailBaseY + (tailY - tailBaseY) * 0.5} r="1.5" fill={tailFill} stroke={tailStroke} strokeWidth="0.25" />
                <circle cx={tailBaseX + (tailX - tailBaseX) * 0.75} cy={tailBaseY + (tailY - tailBaseY) * 0.75} r="1" fill={tailFill} stroke={tailStroke} strokeWidth="0.2" />
                </>
            )
        )}
        </svg>

        {isFocused && element.type !== 'caption' && (
            <div
            onPointerDown={(e) => handlePointerDown(e, 'tail')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute w-4 h-4 bg-ink border-2 border-white rounded-full z-[200] cursor-crosshair"
            style={{ left: `${tailX}%`, top: `${tailY}%`, transform: 'translate(-50%, -50%)' }}
            />
        )}

        <div
        ref={overlayRef}
        onPointerDown={(e) => handlePointerDown(e, 'bubble')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onFocusCapture={() => setIsFocused(true)}
        tabIndex={0}
        className={`comic-overlay-base ${typeClasses[element.type]} ${textOverlayStyle === 'semi-transparent' ? 'text-style-semi-transparent' : textOverlayStyle === 'border-only' ? 'text-style-border-only' : ''} ${isFocused ? 'element-selected shadow-[0_0_15px_rgba(59,130,246,0.5)]' : ''}`}
        style={{
            left: `${element.x}%`,
            top: `${element.y}%`,
            minWidth: '40px',
            maxWidth: '85%',
            fontSize: `${element.fontSize}px`,
            color: element.color,
            zIndex: isDragging ? 200 : 100,
            transform: `rotate(${rotation}deg)`,
        }}
        >
        <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
            dispatch({ type: 'UPDATE_TEXT_ELEMENT', panelId, elementId: element.id, updates: { content: e.currentTarget.textContent || '' } });
            setTimeout(() => {
                if (!document.activeElement?.closest('.text-control-panel')) {
                    setIsFocused(false);
                }
            }, 100);
        }}
        className="outline-none bg-transparent whitespace-pre-wrap break-words min-h-[1em] min-w-[1ch]"
        >
        {element.content}
        </div>

        {isFocused && (
            <div className="text-control-panel absolute -top-16 left-1/2 -translate-x-1/2 bg-card border-2 border-stone-200 rounded-2xl p-2 flex items-center gap-2 shadow-2xl z-[300]">
            <div className="flex flex-col gap-1">
            <div className="flex items-center bg-paper px-2 py-1 rounded border border-stone-200 gap-2">
            <button
            onMouseDown={(e) => { e.preventDefault(); dispatch({ type: 'UPDATE_TEXT_ELEMENT', panelId, elementId: element.id, updates: { fontSize: Math.max(8, element.fontSize - 2) } }); }}
            className="w-7 h-7 flex items-center justify-center text-xs hover:bg-ink hover:text-white rounded-lg text-stone-600 transition-colors"
            >
            A-
            </button>
            <span className="text-[10px] font-body text-center w-6 text-ember-500 font-bold">{element.fontSize}</span>
            <button
            onMouseDown={(e) => { e.preventDefault(); dispatch({ type: 'UPDATE_TEXT_ELEMENT', panelId, elementId: element.id, updates: { fontSize: Math.min(80, element.fontSize + 2) } }); }}
            className="w-7 h-7 flex items-center justify-center text-xs hover:bg-ink hover:text-white rounded-lg text-stone-600 transition-colors"
            >
            A+
            </button>
            </div>
            </div>

            <div className="flex items-center bg-paper px-2 py-1 rounded border border-stone-200 gap-2 h-full self-stretch">
            <span className="text-[9px] font-body text-stone-500 uppercase">ROT</span>
            <input
            type="range" min="-15" max="15" step="1"
            value={rotation}
            onChange={(e) => dispatch({ type: 'UPDATE_TEXT_ELEMENT', panelId, elementId: element.id, updates: { rotation: parseInt(e.target.value) } })}
            onMouseDown={e => e.stopPropagation()}
            className="w-16 accent-ember-500"
            />
            </div>

            <div className="flex items-center bg-paper px-2 py-1 rounded border border-stone-200 gap-1 h-full self-stretch">
            <button
            onMouseDown={(e) => { e.preventDefault(); dispatch({ type: 'UPDATE_TEXT_ELEMENT', panelId, elementId: element.id, updates: { tailStyle: 'pointy' } }); }}
            className={`w-6 h-6 rounded flex items-center justify-center ${tailStyle === 'pointy' ? 'bg-ink text-white' : 'text-stone-600'}`} title="Pointer"
            >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4 22h16L12 2z" /></svg>
            </button>
            <button
            onMouseDown={(e) => { e.preventDefault(); dispatch({ type: 'UPDATE_TEXT_ELEMENT', panelId, elementId: element.id, updates: { tailStyle: 'cloud' } }); }}
            className={`w-6 h-6 rounded flex items-center justify-center ${tailStyle === 'cloud' ? 'bg-ink text-white' : 'text-stone-600'}`} title="Thought"
            >
            <circle cx="12" cy="12" r="8" fill="currentColor" />
            </button>
            <button
            onMouseDown={(e) => { e.preventDefault(); dispatch({ type: 'UPDATE_TEXT_ELEMENT', panelId, elementId: element.id, updates: { tailStyle: 'none' } }); }}
            className={`w-6 h-6 rounded flex items-center justify-center ${tailStyle === 'none' ? 'bg-ink text-white' : 'text-stone-600'}`} title="None"
            >
            <span className="text-[9px] font-bold">Ø</span>
            </button>
            </div>

            <button
            onMouseDown={(e) => { e.preventDefault(); dispatch({ type: 'DELETE_TEXT_ELEMENT', panelId, elementId: element.id }); }}
            className="w-8 h-8 flex items-center justify-center text-xs bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors"
            >
            <Icons.Trash />
            </button>
            </div>
        )}
        </div>
        </>
    );
};

export default TextOverlay;
