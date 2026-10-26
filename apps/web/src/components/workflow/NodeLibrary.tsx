import { useState } from 'react';
import { Search, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import type { CoreNodeType } from '../../types/workflow';
import { NODE_REGISTRY, PALETTE_CATEGORIES } from '../../lib/workflow/registry';

interface NodeLibraryProps {
  isOpen: boolean;
  onToggle: () => void;
  onAddNode: (type: CoreNodeType) => void;
}

export function NodeLibrary({ isOpen, onToggle, onAddNode }: NodeLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (catName: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catName]: !prev[catName] }));
  };

  const filteredCategories = PALETTE_CATEGORIES.map((cat) => {
    const matchingTypes = cat.types.filter((type) => {
      const def = NODE_REGISTRY[type];
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        def.label.toLowerCase().includes(q) ||
        def.description.toLowerCase().includes(q) ||
        def.category.toLowerCase().includes(q)
      );
    });
    return { ...cat, types: matchingTypes };
  }).filter((cat) => cat.types.length > 0);

  return (
    <aside
      className={`shrink-0 border-r border-neutral-800 bg-neutral-950 flex flex-col z-20 transition-all duration-200 select-none ${
        isOpen ? 'w-64' : 'w-12'
      }`}
    >
      {/* ── Library Header ────────────────────────────────────────────── */}
      <div className="flex h-12 items-center justify-between border-b border-neutral-800 px-3">
        {isOpen && (
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-brand-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Node Catalogue
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-900 hover:text-white transition-colors"
          title={isOpen ? 'Collapse node library' : 'Expand node library'}
        >
          <Layers className="size-4" />
        </button>
      </div>

      {isOpen && (
        <>
          {/* ── Search Input ──────────────────────────────────────────── */}
          <div className="p-2.5 border-b border-neutral-800/80">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes..."
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900/90 py-1.5 pl-8 pr-3 text-xs text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* ── Categorized Node Items ─────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {filteredCategories.map((cat) => {
              const isCollapsed = collapsedCategories[cat.name];
              return (
                <div key={cat.name} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.name)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 hover:text-neutral-200"
                  >
                    <span>{cat.name}</span>
                    {isCollapsed ? (
                      <ChevronRight className="size-3 text-neutral-500" />
                    ) : (
                      <ChevronDown className="size-3 text-neutral-500" />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-1">
                      {cat.types.map((type) => {
                        const def = NODE_REGISTRY[type];
                        return (
                          <div
                            key={type}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/quickgent-node-type', type);
                            }}
                            onClick={() => onAddNode(type)}
                            className="group flex items-start gap-2.5 rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-2 text-left transition-all hover:border-neutral-700 hover:bg-neutral-900 cursor-pointer"
                          >
                            <div className="size-6 shrink-0 rounded-md bg-neutral-800/90 flex items-center justify-center mt-0.5 group-hover:scale-105 transition-transform">
                              {def.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-neutral-200 group-hover:text-white truncate">
                                {def.label}
                              </div>
                              <div className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">
                                {def.description}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}
