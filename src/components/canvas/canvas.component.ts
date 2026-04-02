import {
    AfterViewInit,
    Component,
    ElementRef,
    HostListener,
    inject,
    ViewChild,
} from '@angular/core';
import { GraphService, CanvasNode } from '@services/graph';
import { NgClass } from '@angular/common';

@Component({
    selector: 'app-canvas',
    standalone: true,
    template: `
        <div class="graph-canvas" #graphContainer>
            <svg [attr.width]="width" [attr.height]="height">
                <!-- edges -->
                @for (edge of graph.edges(); track edge.src_node + '-' + edge.dst_node) {
                    @let src = getNode(edge.src_node);
                    @let dst = getNode(edge.dst_node);
                    @if (src && dst) {
                        <line
                            [attr.x1]="src.x + 60"
                            [attr.y1]="src.y + 25"
                            [attr.x2]="dst.x + 60"
                            [attr.y2]="dst.y + 25"
                            [attr.stroke]="graph.edgeColor(edge.src_node, edge.src_port)"
                            stroke-width="2"
                        />
                    }
                }

                <!-- pending connection -->
                @if (graph.pending()) {
                    @let p = graph.pending();
                    @if (p != null) {
                        <line
                            [attr.x1]="p.srcX"
                            [attr.y1]="p.srcY"
                            [attr.x2]="p.mouseX"
                            [attr.y2]="p.mouseY"
                            stroke="#3b82f6"
                            stroke-width="2"
                            stroke-dasharray="4 2"
                        />
                    }
                }

                <!-- nodes -->
                @for (node of graph.nodes(); track node.id) {
                    <g
                        [attr.transform]="'translate(' + node.x + ',' + node.y + ')'"
                        (mousedown)="startDrag(node, $event)"
                        (click)="onNodeClick($event, node.id)"
                    >
                        <rect
                            width="120"
                            height="50"
                            [ngClass]="node.hasError ? 'node-rect error' : 'node-rect normal'"
                            [style.stroke]="graph.nodeBorderColor(node.id)"
                        />
                        <text
                            x="60"
                            y="25"
                            fill="#e2e8f0"
                            text-anchor="middle"
                            dominant-baseline="middle"
                            font-size="12"
                            font-weight="500"
                        >
                            {{ node.label }}
                        </text>
                    </g>
                }
            </svg>
        </div>
    `,
    styles: [
        `
            .graph-canvas {
                width: 100%;
                height: 100%;
                background: #070d19;
                overflow: hidden;
            }

            svg {
                width: 100%;
                height: 100%;
                user-select: none;
                cursor: grab;
            }

            .node-rect {
                stroke: #475569;
                stroke-width: 1.5;
                rx: 6px;
                ry: 6px;
                transition:
                    fill 0.1s,
                    stroke 0.1s,
                    filter 0.1s;
                filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
            }

            .node-rect.error {
                fill: #f87171;
            }

            .node-rect.normal {
                fill: #1e293b;
            }

            .node-rect:hover {
                stroke: #3b82f6;
                filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.6));
            }
        `,
    ],
    imports: [NgClass],
})
export class CanvasComponent implements AfterViewInit {
    @ViewChild('graphContainer', { static: true }) container!: ElementRef<HTMLDivElement>;
    graph = inject(GraphService);
    width = 800;
    height = 600;

    private draggingNode: CanvasNode | null = null;
    private offsetX = 0;
    private offsetY = 0;

    private panning = false;
    private panStartX = 0;
    private panStartY = 0;
    private scale = 1;

    ngAfterViewInit() {
        if (typeof window === 'undefined') return; // skip on SSR

        const updateSize = () => {
            const rect = this.container.nativeElement.getBoundingClientRect();
            this.width = rect.width;
            this.height = rect.height;
        };

        setTimeout(updateSize);
        window.addEventListener('resize', updateSize);
    }

    getNode(id: string) {
        return this.graph.nodes().find((n) => n.id === id);
    }

    startDrag(node: CanvasNode, event: MouseEvent) {
        event.preventDefault();
        this.draggingNode = node;
        this.offsetX = event.clientX - node.x;
        this.offsetY = event.clientY - node.y;
    }

    onNodeClick(event: MouseEvent, nodeId: string) {
        if (event.button === 0) {
            this.graph.selectNode(nodeId);
        }
    }

    @HostListener('mousedown', ['$event'])
    onMouseDown(event: MouseEvent) {
        if (event.button === 1) {
            // middle mouse
            this.panning = true;
            this.panStartX = event.clientX;
            this.panStartY = event.clientY;
        }
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        if (this.draggingNode) {
            const x = event.clientX - this.offsetX;
            const y = event.clientY - this.offsetY;
            this.graph.setNodePosition(this.draggingNode.id, x, y);
        } else if (this.panning) {
            const dx = event.clientX - this.panStartX;
            const dy = event.clientY - this.panStartY;
            this.graph.nodes().forEach((n) => {
                this.graph.setNodePosition(n.id, n.x + dx, n.y + dy);
            });
            this.panStartX = event.clientX;
            this.panStartY = event.clientY;
        } else if (this.graph.pending()) {
            this.graph.updateConnection(event.clientX, event.clientY);
        }
    }

    @HostListener('document:mouseup', ['$event'])
    onMouseUp(event: MouseEvent) {
        if (event.button === 1) this.panning = false;
        this.draggingNode = null;
        if (this.graph.pending()) this.graph.cancelConnection();
    }

    @HostListener('wheel', ['$event'])
    onWheel(event: WheelEvent) {
        if (event.ctrlKey) {
            event.preventDefault(); // stop browser zoom

            const zoomFactor = 1.1;
            if (event.deltaY < 0) {
                this.scale *= zoomFactor; // zoom in
            } else {
                this.scale /= zoomFactor; // zoom out
            }

            // scale all nodes relative to canvas center
            const rect = this.container.nativeElement.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;

            this.graph.nodes().forEach((n) => {
                n.x = cx + (n.x - cx) * (event.deltaY < 0 ? zoomFactor : 1 / zoomFactor);
                n.y = cy + (n.y - cy) * (event.deltaY < 0 ? zoomFactor : 1 / zoomFactor);
                this.graph.setNodePosition(n.id, n.x, n.y);
            });
        }
    }

    @HostListener('drop', ['$event'])
    onDrop(event: DragEvent) {
        event.preventDefault();
        const nodeType = event.dataTransfer?.getData('application/strategy-node');
        if (!nodeType) return console.log('No nodeType received');

        // check GraphService
        // const node = this.graph.addNode(nodeType, event.clientX, event.clientY);
    }

    @HostListener('dragover', ['$event'])
    onDragOver(event: DragEvent) {
        event.preventDefault(); // allow drop
    }
}
