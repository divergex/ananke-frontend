import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NODES_BY_CATEGORY, CATEGORIES } from '@lib/node-registry';

/**
 * PaletteComponent displays the node library for the strategy editor.
 *
 * Shows categorized nodes with a search input, allowing users to filter, hover,
 * and drag nodes into the graph. Displays a legend for port types and manages
 * expanded/collapsed category state. Interacts with GraphService indirectly via
 * drag-and-drop node insertion.
 */
@Component({
  selector: 'app-palette',
  standalone: true,
  imports: [FormsModule],
  template: `
    <aside class="palette">
      <div class="palette-header">
        <p class="section-label">Node Library</p>
        <div class="search-wrap">
          <span class="search-icon">⌕</span>
          <input class="search-input" placeholder="Search…" [(ngModel)]="query" />
        </div>
      </div>

      <div class="palette-body">
        @for (cat of filteredCategories(); track cat.id) {
          <div class="category">
            <button class="cat-header" (click)="toggleCat(cat.id)">
              <span class="cat-dot" [style.background]="cat.color"></span>
              <span class="cat-label" [style.color]="cat.color">{{ cat.label }}</span>
              <span class="cat-chevron">{{ expanded()[cat.id] ? '▾' : '▸' }}</span>
            </button>

            @if (expanded()[cat.id]) {
              @for (node of cat.nodes; track node.type) {
                <div
                  class="palette-item"
                  [attr.data-cat-color]="cat.color"
                  draggable="true"
                  (dragstart)="onDragStart($event, node.type)"
                  (mouseenter)="hoveredType.set(node.type)"
                  (mouseleave)="hoveredType.set(null)"
                  [class.hovered]="hoveredType() === node.type"
                  [style.border-color]="
                    hoveredType() === node.type ? cat.color + '55' : 'transparent'
                  "
                  [style.background]="
                    hoveredType() === node.type ? cat.color + '18' : 'transparent'
                  "
                >
                  <span class="item-label">{{ node.label }}</span>
                  @if (hoveredType() === node.type) {
                    <span class="item-desc">{{ node.description }}</span>
                  }
                </div>
              }
            }
          </div>
        }
      </div>

      <!-- Dtype legend -->
      <div class="legend">
        <p class="section-label">Port types</p>
        @for (entry of dtypeLegend; track entry.badge) {
          <div class="legend-row">
            <span
              class="legend-badge"
              [style.background]="entry.color + '30'"
              [style.color]="entry.color"
            >
              {{ entry.badge }}
            </span>
            <span class="legend-name">{{ entry.name }}</span>
          </div>
        }
      </div>
    </aside>
  `,
  styles: [
    `
      .palette {
        width: 216px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        border-right: 1px solid #1e293b;
        background: #070d19;
        overflow: hidden;
      }
      .palette-header {
        padding: 10px;
        border-bottom: 1px solid #1e293b;
      }
      .section-label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #475569;
        font-weight: 600;
        margin: 0 0 6px;
      }
      .search-wrap {
        position: relative;
      }
      .search-icon {
        position: absolute;
        left: 7px;
        top: 50%;
        transform: translateY(-50%);
        color: #475569;
        font-size: 13px;
        pointer-events: none;
      }
      .search-input {
        width: 100%;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 5px;
        padding: 5px 8px 5px 22px;
        font-size: 11px;
        color: #cbd5e1;
        outline: none;
        font-family: monospace;
      }
      .search-input:focus {
        border-color: #475569;
      }
      .search-input::placeholder {
        color: #475569;
      }

      .palette-body {
        flex: 1;
        overflow-y: auto;
        padding: 4px 0;
      }

      .category {
      }
      .cat-header {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 5px 10px;
        background: transparent;
        border: none;
        cursor: pointer;
        transition: background 0.1s;
      }
      .cat-header:hover {
        background: #0f172a;
      }
      .cat-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .cat-label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
        flex: 1;
        text-align: left;
      }
      .cat-chevron {
        font-size: 9px;
        color: #475569;
      }

      .palette-item {
        margin: 1px 7px;
        border-radius: 5px;
        padding: 6px 8px;
        cursor: grab;
        border: 1px solid transparent;
        transition:
          background 0.1s,
          border-color 0.1s;
      }
      .palette-item:active {
        cursor: grabbing;
      }
      .item-label {
        display: block;
        font-size: 11px;
        color: #cbd5e1;
        font-weight: 500;
      }
      .item-desc {
        display: block;
        font-size: 9px;
        color: #64748b;
        margin-top: 2px;
        line-height: 1.4;
      }

      .legend {
        border-top: 1px solid #1e293b;
        padding: 8px 10px;
      }
      .legend-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 3px;
      }
      .legend-badge {
        border-radius: 3px;
        padding: 1px 4px;
        font-size: 8px;
        font-weight: 700;
        line-height: 1.4;
      }
      .legend-name {
        font-size: 9px;
        color: #475569;
      }
    `,
  ],
})
export class PaletteComponent {
  query = signal('');
  expanded = signal<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.id, true])),
  );
  hoveredType = signal<string | null>(null);

  dtypeLegend = [
    { badge: 'f', color: '#3b82f6', name: 'FLOAT' },
    { badge: 'b', color: '#f59e0b', name: 'BOOL' },
    { badge: 'i', color: '#8b5cf6', name: 'INT' },
    { badge: 'L', color: '#14b8a6', name: 'LOB' },
    { badge: 'O', color: '#ef4444', name: 'ORDER' },
  ];

  filteredCategories() {
    const q = this.query().toLowerCase();
    return NODES_BY_CATEGORY.map((cat) => ({
      ...cat,
      nodes: cat.nodes.filter(
        (n) =>
          !q ||
          n.label.toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.nodes.length > 0);
  }

  toggleCat(id: string) {
    this.expanded.update((e) => ({ ...e, [id]: !e[id] }));
  }

  onDragStart(event: DragEvent, nodeType: string) {
    event.dataTransfer?.setData('application/strategy-node', nodeType);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }
}
