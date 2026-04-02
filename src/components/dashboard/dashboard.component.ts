import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { XmlPanelComponent } from '../xml-panel/xml-panel.component';
import { PaletteComponent } from '../palette/palette.component';
import { PropertiesComponent } from '../properties/properties.component';
import { GraphService } from '@services/graph';
import { CanvasComponent } from '../canvas/canvas.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ToolbarComponent,
    XmlPanelComponent,
    PaletteComponent,
    PropertiesComponent,
    CanvasComponent,
  ],
  template: `
      <div class="dashboard">
          <app-palette></app-palette>

          <div class="editor-area">
              <app-toolbar
                  (zoomIn)="graph.autoLayout()"
                  (zoomOut)="graph.clearGraph()"
                  (fitView)="graph.autoLayout()"
                  (layout)="graph.autoLayout()"
                  (openXml)="graph.showXmlPanel.set(true)"
              >
              </app-toolbar>

              <div class="graph-canvas">
                  <app-canvas></app-canvas>
                  <!-- main canvas with nodes/edges -->
              </div>
          </div>

          <app-properties></app-properties>

          @if (graph.showXmlPanel()) {
              <app-xml-panel></app-xml-panel>
          }
      </div>
  `,
  styles: [
    `
      .dashboard {
        display: flex;
        height: 100vh;
        background: #070d19;
        color: #cbd5e1;
      }
      .editor-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .graph-canvas {
        flex: 1;
        position: relative;
        background: #0a0f1a;
      }
    `,
  ],
})
export class DashboardComponent {
  graph = inject(GraphService);
}
