import React, { useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useLitStore } from '../../store';
import { useGraphLayout, Completeness } from '../../hooks/useGraphLayout';
import { LORE_TYPE_CONFIG } from '../../utils/loreConfig';
import { LoreType } from '../../types';

// ─── Custom Node Component ──────────────────────────────────────────────────

interface EntityNodeData {
  entityId: string;
  entityKind: 'character' | 'lore';
  entityType: string;
  label: string;
  description: string;
  hasImage: boolean;
  completeness: Completeness;
  tags: string[];
  role?: string;
  loreType?: LoreType;
}

const EntityNode: React.FC<NodeProps<EntityNodeData>> = ({ data }) => {
  const openDetail = useLitStore((s) => s.openDetail);

  const handleClick = () => {
    openDetail({ kind: data.entityKind, id: data.entityId });
  };

  // Completeness styling
  let borderClass = 'border-red-500 shadow-red-500/20';
  let pulseClass = '';
  if (data.completeness === 'missing') {
    borderClass = 'border-red-500 shadow-red-500/20';
    pulseClass = 'animate-[pulse_2s_ease-in-out_infinite]';
  } else if (data.completeness === 'partial') {
    borderClass = 'border-amber-500 shadow-amber-500/20';
  } else {
    borderClass = 'border-emerald-500 shadow-emerald-500/10';
  }

  // Accent color
  const accentColor = data.entityKind === 'character'
    ? '#f59e0b' // amber for characters
    : data.loreType
      ? LORE_TYPE_CONFIG[data.loreType].accentHex
      : '#6366f1'; // fallback indigo

  // Type badge
  const typeBadge = data.entityKind === 'character'
    ? data.role
    : data.loreType
      ? LORE_TYPE_CONFIG[data.loreType].label
      : 'Unknown';
  
  const typeIcon = data.entityKind === 'character'
    ? null
    : data.loreType
      ? LORE_TYPE_CONFIG[data.loreType].icon
      : null;

  return (
    <>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-steel-400" />
      
      <div
        onClick={handleClick}
        className={`card rounded-xl overflow-hidden border-2 w-[210px] cursor-pointer transition-transform hover:scale-105 ${borderClass} ${pulseClass}`}
      >
        {/* Accent bar */}
        <div className="h-2" style={{ backgroundColor: accentColor }} />
        
        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Type badge */}
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-steel-500">
            {typeIcon}
            <span>{typeBadge}</span>
          </div>
          
          {/* Name */}
          <div className="text-xs font-display font-bold text-steel-100 truncate">
            {data.label}
          </div>
          
          {/* Description */}
          {data.description ? (
            <div className="text-[10px] text-steel-400 line-clamp-2 leading-relaxed">
              {data.description}
            </div>
          ) : (
            <div className="text-[10px] text-red-400 italic">
              ⚠ No description
            </div>
          )}
          
          {/* Tags */}
          {data.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {data.tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-ink-700 text-steel-400 text-[8px] rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-steel-400" />
    </>
  );
};

// Node types must be stable (defined outside component)
const nodeTypes = {
  entityNode: EntityNode,
};

// ─── Main LoreMap Component ─────────────────────────────────────────────────

const LoreMap: React.FC = () => {
  const { characters, loreEntries, relationships } = useLitStore();
  
  // Get layout
  const { nodes: layoutNodes, edges: layoutEdges } = useGraphLayout(
    characters,
    loreEntries,
    relationships
  );

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Sync layout data into React Flow state
  useEffect(() => {
    setNodes(layoutNodes as Node[]);
    setEdges(layoutEdges as Edge[]);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  // Stats
  const stats = useMemo(() => {
    const total = layoutNodes.length;
    const missing = layoutNodes.filter(n => n.data.completeness === 'missing').length;
    const partial = layoutNodes.filter(n => n.data.completeness === 'partial').length;
    const complete = layoutNodes.filter(n => n.data.completeness === 'complete').length;
    return { total, missing, partial, complete };
  }, [layoutNodes]);

  // MiniMap node color based on completeness
  const miniMapNodeColor = (node: Node) => {
    const completeness = (node.data as EntityNodeData).completeness;
    if (completeness === 'missing') return '#ef4444'; // red-500
    if (completeness === 'partial') return '#f59e0b'; // amber-500
    return '#10b981'; // emerald-500
  };

  // Empty state
  if (layoutNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-steel-500 text-sm">
        No entities yet
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        className="bg-ink-950"
      >
        <Background color="#27272a" gap={24} />
        <Controls className="!bg-ink-900 !border-ink-700 [&>button]:!bg-ink-800 [&>button]:!border-ink-700 [&>button]:!text-steel-300" />
        <MiniMap
          nodeColor={miniMapNodeColor}
          className="!bg-ink-900 !border-ink-700"
          maskColor="rgba(24, 24, 27, 0.8)"
        />
      </ReactFlow>

      {/* Stats overlay */}
      <div className="glass-panel absolute top-4 left-4 px-4 py-3 rounded-lg space-y-2 text-xs z-10">
        <div className="flex items-center gap-2 text-steel-300">
          <span className="font-bold">{stats.total}</span>
          <span className="text-steel-500">total nodes</span>
        </div>
        {stats.missing > 0 && (
          <div className="flex items-center gap-2 text-red-400">
            <span className="font-bold">{stats.missing}</span>
            <span className="text-steel-500">missing</span>
          </div>
        )}
        {stats.partial > 0 && (
          <div className="flex items-center gap-2 text-amber-400">
            <span className="font-bold">{stats.partial}</span>
            <span className="text-steel-500">incomplete</span>
          </div>
        )}
        {stats.complete > 0 && (
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="font-bold">{stats.complete}</span>
            <span className="text-steel-500">complete</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoreMap;
