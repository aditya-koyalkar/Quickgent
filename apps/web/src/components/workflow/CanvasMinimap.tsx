import type { WorkflowGraph } from '../../types/workflow';
import { NODE_WIDTH, NODE_HEIGHT } from '../../pages/ProjectStudioPage';

interface CanvasMinimapProps {
  graph: WorkflowGraph;
  pan: { x: number; y: number };
  zoom: number;
  viewportSize: { width: number; height: number };
}

export function CanvasMinimap({ graph, pan, zoom, viewportSize }: CanvasMinimapProps) {
  if (graph.nodes.length === 0) return null;

  const miniW = 160;
  const miniH = 100;

  // Compute bounding box of nodes
  const minX = Math.min(0, ...graph.nodes.map((n) => n.position.x));
  const maxX = Math.max(800, ...graph.nodes.map((n) => n.position.x + NODE_WIDTH));
  const minY = Math.min(0, ...graph.nodes.map((n) => n.position.y));
  const maxY = Math.max(600, ...graph.nodes.map((n) => n.position.y + NODE_HEIGHT));

  const totalW = Math.max(100, maxX - minX + 200);
  const totalH = Math.max(100, maxY - minY + 200);

  const scaleX = miniW / totalW;
  const scaleY = miniH / totalH;
  const scale = Math.min(scaleX, scaleY);

  // Compute viewport rectangle in minimap
  const viewX = (-pan.x / zoom - minX) * scale;
  const viewY = (-pan.y / zoom - minY) * scale;
  const viewW = (viewportSize.width / zoom) * scale;
  const viewH = (viewportSize.height / zoom) * scale;

  return (
    <div className="absolute bottom-5 right-5 z-20 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/90 p-1.5 shadow-2xl backdrop-blur-md">
      <div
        className="relative overflow-hidden rounded-lg bg-black/60 border border-neutral-900"
        style={{ width: `${miniW}px`, height: `${miniH}px` }}
      >
        {/* Render scaled node boxes */}
        {graph.nodes.map((node) => {
          const nx = (node.position.x - minX) * scale;
          const ny = (node.position.y - minY) * scale;
          const nw = Math.max(3, NODE_WIDTH * scale);
          const nh = Math.max(2, NODE_HEIGHT * scale);

          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: `${nx}px`,
                top: `${ny}px`,
                width: `${nw}px`,
                height: `${nh}px`,
              }}
              className="rounded-xs bg-neutral-600/80 border border-neutral-500/50"
            />
          );
        })}

        {/* Viewport Box */}
        <div
          style={{
            position: 'absolute',
            left: `${Math.max(0, viewX)}px`,
            top: `${Math.max(0, viewY)}px`,
            width: `${Math.min(miniW, Math.max(10, viewW))}px`,
            height: `${Math.min(miniH, Math.max(10, viewH))}px`,
          }}
          className="pointer-events-none rounded border border-brand-400 bg-brand-400/10"
        />
      </div>
    </div>
  );
}
