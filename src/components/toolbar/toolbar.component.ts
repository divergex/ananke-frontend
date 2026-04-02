import { Component, inject, output } from '@angular/core';
import { GraphService } from '@services/graph';

/**
 * ToolbarComponent provides the main action bar for the Strategy Editor.
 *
 * Displays the application branding, graph statistics, and buttons for zooming,
 * fitting the view, layout, XML export, and clearing the graph. It emits events
 * for zoom, layout, and XML actions, and interacts with GraphService to show
 * current graph state and perform clear operations.
 */
@Component({
  selector: 'app-toolbar',
  standalone: true,
  template: `
      <header class="toolbar">
          <div class="brand">
              <div class="brand-icon">SE</div>
              <span class="brand-name">Strategy Editor</span>
          </div>
          <div class="divider"></div>

          <div class="btn-group">
              <button class="tool-btn" title="Zoom out" (click)="zoomOut.emit()">−</button>
              <!--        <button class="tool-btn" title="Fit view" (click)="fitView.emit()">fit</button>-->
              <button class="tool-btn" title="Zoom in" (click)="zoomIn.emit()">+</button>
          </div>

          <div class="divider"></div>

          <button class="tool-btn" (click)="layout.emit()">⊞ Layout</button>

          <div class="divider"></div>

          <span class="stat-text">{{ graph.nodes().length }}n · {{ graph.edges().length }}e</span>

          <div class="spacer"></div>

          @if (graph.errorCount() > 0) {
              <button class="status error" (click)="openXml.emit()">
                  ✕ {{ graph.errorCount() }} error{{ graph.errorCount() > 1 ? 's' : '' }}
              </button>
          } @else if (graph.warningCount() > 0) {
              <button class="status warn" (click)="openXml.emit()">
                  ⚠ {{ graph.warningCount() }} warning{{ graph.warningCount() > 1 ? 's' : '' }}
              </button>
          } @else if (graph.nodes().length > 0) {
              <span class="status ok">✓ valid</span>
          }

          <div class="divider"></div>

          <button class="tool-btn outlined" (click)="openXml.emit()">&lt;/&gt; XML</button>
          <button class="tool-btn danger" title="Clear graph" (click)="confirmClear()">🗑</button>
      </header>
  `,
  styles: [
    `
      .toolbar {
        height: 44px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 12px;
        border-bottom: 1px solid #1e293b;
        background: #0a0f1a;
        flex-shrink: 0;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-right: 6px;
      }
      .brand-icon {
        width: 22px;
        height: 22px;
        border-radius: 5px;
        background: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        font-weight: 700;
        color: #fff;
      }
      .brand-name {
        font-size: 13px;
        font-weight: 600;
        color: #e2e8f0;
        letter-spacing: -0.3px;
      }
      .divider {
        width: 1px;
        height: 20px;
        background: #1e293b;
        margin: 0 2px;
      }
      .spacer {
        flex: 1;
      }
      .stat-text {
        font-size: 10px;
        color: #475569;
        font-family: monospace;
      }

      .tool-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 5px;
        border: none;
        background: transparent;
        color: #94a3b8;
        font-size: 11px;
        cursor: pointer;
        font-family: monospace;
        transition:
          background 0.15s,
          color 0.15s;
      }
      .tool-btn:hover {
        background: #1e293b;
        color: #e2e8f0;
      }
      .tool-btn.outlined {
        border: 1px solid #334155;
      }
      .tool-btn.outlined:hover {
        border-color: #475569;
      }
      .tool-btn.danger:hover {
        color: #f87171;
        background: rgba(239, 68, 68, 0.1);
      }

      .status {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 12px;
        border: none;
        cursor: pointer;
        font-family: monospace;
        background: transparent;
      }
      .status.error {
        color: #f87171;
        border: 1px solid #7f1d1d;
        background: rgba(127, 29, 29, 0.3);
      }
      .status.warn {
        color: #fbbf24;
        border: 1px solid #78350f;
        background: rgba(120, 53, 15, 0.3);
      }
      .status.ok {
        color: #34d399;
        border: 1px solid #064e3b;
        background: rgba(6, 78, 59, 0.2);
        cursor: default;
      }
    `,
  ],
})
export class ToolbarComponent {
  graph = inject(GraphService);

  zoomIn = output();
  zoomOut = output();
  fitView = output();
  layout = output();
  openXml = output();

  confirmClear() {
    if (this.graph.nodes().length === 0 || confirm('Clear the entire graph?')) {
      this.graph.clearGraph();
    }
  }
}
