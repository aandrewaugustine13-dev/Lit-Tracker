import { useMemo } from 'react';
import dagre from 'dagre';
import { Position } from 'reactflow';
import { Character, LoreEntry, Relationship, LoreType } from '../types';
import { LORE_TYPE_CONFIG } from '../utils/loreConfig';

export type Completeness = 'missing' | 'partial' | 'complete';

interface NodeData {
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

interface LayoutNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: NodeData;
  sourcePosition: Position;
  targetPosition: Position;
}

interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  style?: React.CSSProperties;
  label?: string;
}

/**
 * Determine completeness for a character
 * - missing: no description AND empty gallery
 * - partial: one is missing
 * - complete: both exist
 */
export function getCharacterCompleteness(char: Character): Completeness {
  const hasDescription = char.description && char.description.trim().length > 0;
  const hasGallery = char.gallery && char.gallery.length > 0;
  
  if (!hasDescription && !hasGallery) return 'missing';
  if (hasDescription && hasGallery) return 'complete';
  return 'partial';
}

/**
 * Determine completeness for a lore entry
 * - missing: no description
 * - partial: description exists but tags is empty
 * - complete: both exist
 */
export function getLoreCompleteness(entry: LoreEntry): Completeness {
  const hasDescription = entry.description && entry.description.trim().length > 0;
  const hasTags = entry.tags && entry.tags.length > 0;
  
  if (!hasDescription) return 'missing';
  if (hasDescription && hasTags) return 'complete';
  return 'partial';
}

/**
 * Hook to compute positioned nodes and edges from store data
 */
export function useGraphLayout(
  characters: Character[],
  loreEntries: LoreEntry[],
  relationships: Relationship[]
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  return useMemo(() => {
    const nodes: LayoutNode[] = [];
    const edges: LayoutEdge[] = [];
    const edgeSet = new Set<string>(); // for deduplication

    // Build character nodes
    characters.forEach((char) => {
      const completeness = getCharacterCompleteness(char);
      const tags = Object.keys(char.smart_tags || {}).slice(0, 3);
      
      nodes.push({
        id: `char-${char.id}`,
        type: 'entityNode',
        position: { x: 0, y: 0 }, // will be set by dagre
        data: {
          entityId: char.id,
          entityKind: 'character',
          entityType: 'character',
          label: char.name,
          description: char.description || '',
          hasImage: (char.gallery || []).length > 0,
          completeness,
          tags,
          role: char.role,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });
    });

    // Build lore entry nodes
    loreEntries.forEach((entry) => {
      const completeness = getLoreCompleteness(entry);
      const tags = (entry.tags || []).slice(0, 3);
      
      nodes.push({
        id: `lore-${entry.id}`,
        type: 'entityNode',
        position: { x: 0, y: 0 }, // will be set by dagre
        data: {
          entityId: entry.id,
          entityKind: 'lore',
          entityType: entry.type,
          label: entry.name,
          description: entry.description || '',
          hasImage: false,
          completeness,
          tags,
          loreType: entry.type,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });
    });

    // Build Character ↔ Lore edges (indigo, animated)
    characters.forEach((char) => {
      (char.loreEntryIds || []).forEach((loreId) => {
        const edgeId = `char-${char.id}-lore-${loreId}`;
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          edges.push({
            id: edgeId,
            source: `char-${char.id}`,
            target: `lore-${loreId}`,
            animated: true,
            style: {
              stroke: '#6366f1', // indigo
              strokeWidth: 1.5,
              opacity: 0.5,
            },
          });
        }
      });
    });

    // Build Lore ↔ Lore edges (violet, dashed) - deduplicate bidirectional
    loreEntries.forEach((entry) => {
      (entry.relatedEntryIds || []).forEach((relatedId) => {
        const edgeKey = [entry.id, relatedId].sort().join('-');
        const edgeId = `lore-${edgeKey}`;
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          edges.push({
            id: edgeId,
            source: `lore-${entry.id}`,
            target: `lore-${relatedId}`,
            style: {
              stroke: '#a78bfa', // violet
              strokeDasharray: '6 3',
              strokeWidth: 1,
              opacity: 0.35,
            },
          });
        }
      });
    });

    // Build Character ↔ Character edges (amber, with label)
    relationships.forEach((rel) => {
      const edgeId = `rel-${rel.id}`;
      if (!edgeSet.has(edgeId)) {
        edgeSet.add(edgeId);
        edges.push({
          id: edgeId,
          source: `char-${rel.fromId}`,
          target: `char-${rel.toId}`,
          label: rel.label,
          style: {
            stroke: '#f59e0b', // amber
            strokeWidth: 1.5,
            opacity: 0.45,
          },
        });
      }
    });

    // Apply dagre layout
    if (nodes.length === 0) {
      return { nodes, edges };
    }

    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'TB',
      nodesep: 60,
      ranksep: 100,
      marginx: 40,
      marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 220;
    const nodeHeight = 100;

    // Add nodes with ranks for grouping
    nodes.forEach((node) => {
      let rank = 1; // default for most lore types
      
      if (node.data.entityKind === 'character') {
        rank = 0; // Characters at top
      } else if (node.data.loreType === LoreType.LOCATION) {
        rank = 2; // Locations in middle
      } else if (node.data.loreType === LoreType.ARTIFACT) {
        rank = 3; // Artifacts at bottom
      }
      // Factions, Concepts, Events, Rules remain at rank 1
      
      g.setNode(node.id, { width: nodeWidth, height: nodeHeight, rank });
    });

    // Add edges
    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    // Run layout
    dagre.layout(g);

    // Update node positions (centered)
    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = g.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - nodeWidth / 2,
          y: nodeWithPosition.y - nodeHeight / 2,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  }, [characters, loreEntries, relationships]);
}
