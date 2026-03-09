'use client';

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/calculations';

interface SankeyNode {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

interface SankeyDiagramProps {
  income: number;
  buckets: { label: string; amount: number; color: string; items?: { label: string; amount: number }[] }[];
}

export default function SankeyDiagram({ income, buckets }: SankeyDiagramProps) {
  const { nodes, links, positions } = useMemo(() => {
    if (income <= 0) return { nodes: [], links: [], positions: new Map() };

    // Build nodes: 3 columns — [Income] → [Buckets] → [Sub-categories]
    const allNodes: SankeyNode[] = [];
    const allLinks: SankeyLink[] = [];

    // Column 0: Income
    allNodes.push({ id: 'income', label: 'Net Income', value: income, color: '#6366f1' });

    // Column 1: Buckets + Column 2: Sub-items
    for (const bucket of buckets) {
      if (bucket.amount <= 0) continue;
      const bucketId = `b_${bucket.label}`;
      allNodes.push({ id: bucketId, label: bucket.label, value: bucket.amount, color: bucket.color });
      allLinks.push({ source: 'income', target: bucketId, value: bucket.amount });

      if (bucket.items) {
        for (const item of bucket.items) {
          if (item.amount <= 0) continue;
          const itemId = `i_${bucket.label}_${item.label}`;
          allNodes.push({ id: itemId, label: item.label, value: item.amount, color: bucket.color });
          allLinks.push({ source: bucketId, target: itemId, value: item.amount });
        }
      }
    }

    // Layout: assign x/y positions
    const colNodes: string[][] = [['income'], [], []];
    for (const bucket of buckets) {
      if (bucket.amount <= 0) continue;
      const bucketId = `b_${bucket.label}`;
      colNodes[1].push(bucketId);
      if (bucket.items) {
        for (const item of bucket.items) {
          if (item.amount <= 0) continue;
          colNodes[2].push(`i_${bucket.label}_${item.label}`);
        }
      }
    }

    const W = 800;
    const nodeWidth = 12;
    const colX = [40, W / 2 - nodeWidth / 2, W - 40 - nodeWidth];

    // Compute y positions based on value proportions
    const pos = new Map<string, { x: number; y: number; h: number }>();
    const H = 400;
    const padding = 6;

    for (let col = 0; col < 3; col++) {
      const ids = colNodes[col];
      if (ids.length === 0) continue;
      const totalVal = ids.reduce((s, id) => s + (allNodes.find(n => n.id === id)?.value || 0), 0);
      const totalPadding = (ids.length - 1) * padding;
      const availableH = H - totalPadding;
      let y = 0;

      for (const id of ids) {
        const node = allNodes.find(n => n.id === id);
        if (!node) continue;
        const h = Math.max(4, (node.value / totalVal) * availableH);
        pos.set(id, { x: colX[col], y, h });
        y += h + padding;
      }
    }

    return { nodes: allNodes, links: allLinks, positions: pos };
  }, [income, buckets]);

  if (nodes.length === 0) return null;

  // Track how much of each node's height has been used for outgoing/incoming links
  const sourceOffsets = new Map<string, number>();
  const targetOffsets = new Map<string, number>();

  const svgH = 420;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 800 ${svgH}`} className="w-full" style={{ minWidth: 600 }}>
        <defs>
          {links.map((link, i) => {
            const sn = nodes.find(n => n.id === link.source);
            const tn = nodes.find(n => n.id === link.target);
            if (!sn || !tn) return null;
            return (
              <linearGradient key={i} id={`grad-${i}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={sn.color} stopOpacity="0.4" />
                <stop offset="100%" stopColor={tn.color} stopOpacity="0.4" />
              </linearGradient>
            );
          })}
        </defs>

        {/* Links */}
        {links.map((link, i) => {
          const sp = positions.get(link.source);
          const tp = positions.get(link.target);
          const sNode = nodes.find(n => n.id === link.source);
          const tNode = nodes.find(n => n.id === link.target);
          if (!sp || !tp || !sNode || !tNode) return null;

          const sOffset = sourceOffsets.get(link.source) || 0;
          const tOffset = targetOffsets.get(link.target) || 0;
          const linkH_s = (link.value / sNode.value) * sp.h;
          const linkH_t = (link.value / tNode.value) * tp.h;

          const x0 = sp.x + 12;
          const y0 = sp.y + sOffset;
          const x1 = tp.x;
          const y1 = tp.y + tOffset;

          sourceOffsets.set(link.source, sOffset + linkH_s);
          targetOffsets.set(link.target, tOffset + linkH_t);

          const mx = (x0 + x1) / 2;
          const path = `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1} L${x1},${y1 + linkH_t} C${mx},${y1 + linkH_t} ${mx},${y0 + linkH_s} ${x0},${y0 + linkH_s} Z`;

          return (
            <path
              key={i}
              d={path}
              fill={`url(#grad-${i})`}
              className="hover:opacity-80 transition-opacity"
            >
              <title>{`${sNode.label} → ${tNode.label}: ${formatCurrency(link.value)}`}</title>
            </path>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const p = positions.get(node.id);
          if (!p) return null;
          const isLeft = node.id === 'income';
          const isRight = node.id.startsWith('i_');

          return (
            <g key={node.id}>
              <rect
                x={p.x}
                y={p.y}
                width={12}
                height={p.h}
                rx={3}
                fill={node.color}
                opacity={0.9}
              />
              <text
                x={isRight ? p.x + 18 : isLeft ? p.x - 6 : p.x + 6}
                y={p.y + p.h / 2}
                textAnchor={isRight ? 'start' : isLeft ? 'end' : 'middle'}
                dominantBaseline="central"
                className="text-[10px] fill-[var(--text-secondary)]"
                style={{ fontSize: 10 }}
              >
                {node.label}
              </text>
              {p.h > 14 && (
                <text
                  x={isRight ? p.x + 18 : isLeft ? p.x - 6 : p.x + 6}
                  y={p.y + p.h / 2 + 12}
                  textAnchor={isRight ? 'start' : isLeft ? 'end' : 'middle'}
                  dominantBaseline="central"
                  className="text-[9px] fill-[var(--text-secondary)] opacity-50"
                  style={{ fontSize: 9 }}
                >
                  {formatCurrency(node.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
