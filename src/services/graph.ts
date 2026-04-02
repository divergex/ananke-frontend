import { Injectable, signal, computed } from '@angular/core';
import { NODE_BY_TYPE, DTYPE_COLORS, type DType } from '@lib/node-registry';
import {
    graphToXml,
    xmlToGraph,
    validateGraph,
    EXAMPLE_XML,
    type SerializedNode,
    type SerializedEdge,
    type ValidationIssue,
} from '@lib/xml-serializer';

// ─── Canvas node (extends serialized with runtime position + selection) ───────

export interface CanvasNode extends SerializedNode {
    selected: boolean;
    hasError: boolean;
    hasWarning: boolean;
}

// ─── In-progress connection (drawn while user drags from a port) ──────────────

export interface PendingConnection {
    srcNodeId: string;
    srcPort: string;
    srcX: number;
    srcY: number;
    mouseX: number;
    mouseY: number;
    color: string;
}

let _idCounter = 1;
function newId() {
    return `n${_idCounter++}`;
}

@Injectable({ providedIn: 'root' })
export class GraphService {
    // ─── Core state (signals) ─────────────────────────────────────────────────
    readonly nodes = signal<CanvasNode[]>([]);
    readonly edges = signal<SerializedEdge[]>([]);
    readonly pending = signal<PendingConnection | null>(null);
    readonly selectedNodeId = signal<string | null>(null);
    readonly showXmlPanel = signal(false);

    // ─── Derived ──────────────────────────────────────────────────────────────
    readonly issues = computed<ValidationIssue[]>(() => {
        if (this.nodes().length === 0) return [];
        return validateGraph({ nodes: this.nodes(), edges: this.edges() });
    });

    readonly errorCount = computed(() => this.issues().filter((i) => i.level === 'error').length);
    readonly warningCount = computed(() => this.issues().filter((i) => i.level === 'warn').length);

    readonly selectedNode = computed(
        () => this.nodes().find((n) => n.id === this.selectedNodeId()) ?? null,
    );

    readonly currentXml = computed(() => graphToXml({ nodes: this.nodes(), edges: this.edges() }));

    // ─── Init ─────────────────────────────────────────────────────────────────
    constructor() {
        this.loadXml(EXAMPLE_XML);
    }

    // ─── Load / import ────────────────────────────────────────────────────────
    loadXml(xml: string) {
        const graph = xmlToGraph(xml);
        this.nodes.set(
            graph.nodes.map((n) => ({ ...n, selected: false, hasError: false, hasWarning: false })),
        );
        this.edges.set(graph.edges);
        this.selectedNodeId.set(null);
        this._revalidate();
    }

    // ─── Node operations ──────────────────────────────────────────────────────
    addNode(nodeType: string, x: number, y: number): string {
        const def = NODE_BY_TYPE[nodeType];
        const id = newId();
        const label = def?.label ?? nodeType;
        const params = (def?.params ?? []).map((p) => ({ name: p.name, value: String(p.default) }));
        const node: CanvasNode = {
            id,
            type: nodeType,
            label,
            x,
            y,
            params,
            selected: false,
            hasError: false,
            hasWarning: false,
        };
        this.nodes.update((ns) => [...ns, node]);
        this.selectNode(id);
        return id;
    }

    moveNode(id: string, dx: number, dy: number) {
        this.nodes.update((ns) =>
            ns.map((n) =>
                n.id === id ? { ...n, x: Math.round(n.x + dx), y: Math.round(n.y + dy) } : n,
            ),
        );
    }

    setNodePosition(id: string, x: number, y: number) {
        this.nodes.update((ns) =>
            ns.map((n) => (n.id === id ? { ...n, x: Math.round(x), y: Math.round(y) } : n)),
        );
    }

    updateParam(nodeId: string, paramName: string, value: string) {
        this.nodes.update((ns) =>
            ns.map((n) =>
                n.id === nodeId
                    ? {
                          ...n,
                          params: n.params.map((p) => (p.name === paramName ? { ...p, value } : p)),
                      }
                    : n,
            ),
        );
        this._revalidate();
    }

    updateLabel(nodeId: string, label: string) {
        this.nodes.update((ns) => ns.map((n) => (n.id === nodeId ? { ...n, label } : n)));
    }

    deleteNode(id: string) {
        this.nodes.update((ns) => ns.filter((n) => n.id !== id));
        this.edges.update((es) => es.filter((e) => e.src_node !== id && e.dst_node !== id));
        if (this.selectedNodeId() === id) this.selectedNodeId.set(null);
        this._revalidate();
    }

    selectNode(id: string | null) {
        this.selectedNodeId.set(id);
    }

    clearGraph() {
        this.nodes.set([]);
        this.edges.set([]);
        this.selectedNodeId.set(null);
    }

    // ─── Edge operations ──────────────────────────────────────────────────────
    addEdge(edge: SerializedEdge) {
        // Prevent duplicate edges
        const exists = this.edges().some(
            (e) =>
                e.src_node === edge.src_node &&
                e.src_port === edge.src_port &&
                e.dst_node === edge.dst_node &&
                e.dst_port === edge.dst_port,
        );
        if (!exists) {
            // Remove any existing edge going into same dst port (one source per input)
            this.edges.update((es) => [
                ...es.filter(
                    (e) => !(e.dst_node === edge.dst_node && e.dst_port === edge.dst_port),
                ),
                edge,
            ]);
            this._revalidate();
        }
    }

    deleteEdgesForNode(nodeId: string) {
        this.edges.update((es) => es.filter((e) => e.src_node !== nodeId && e.dst_node !== nodeId));
        this._revalidate();
    }

    // ─── Pending connection (during drag) ────────────────────────────────────
    startConnection(conn: PendingConnection) {
        this.pending.set(conn);
    }
    updateConnection(mouseX: number, mouseY: number) {
        this.pending.update((p) => (p ? { ...p, mouseX, mouseY } : null));
    }
    cancelConnection() {
        this.pending.set(null);
    }

    // ─── Auto-layout ──────────────────────────────────────────────────────────
    autoLayout() {
        const nodes = this.nodes();
        const edges = this.edges();

        const succs: Record<string, string[]> = {};
        const inDeg: Record<string, number> = {};
        for (const n of nodes) {
            succs[n.id] = [];
            inDeg[n.id] = 0;
        }
        for (const e of edges) {
            succs[e.src_node]?.push(e.dst_node);
            inDeg[e.dst_node] = (inDeg[e.dst_node] ?? 0) + 1;
        }

        const queue = nodes.filter((n) => inDeg[n.id] === 0).map((n) => n.id);
        const layer: Record<string, number> = {};
        let head = 0;
        while (head < queue.length) {
            const id = queue[head++];
            layer[id] = layer[id] ?? 0;
            for (const s of succs[id] ?? []) {
                inDeg[s]--;
                layer[s] = Math.max(layer[s] ?? 0, (layer[id] ?? 0) + 1);
                if (inDeg[s] === 0) queue.push(s);
            }
        }

        const layerNodes: Record<number, string[]> = {};
        for (const n of nodes) {
            const l = layer[n.id] ?? 0;
            layerNodes[l] = layerNodes[l] ?? [];
            layerNodes[l].push(n.id);
        }

        const X_GAP = 280,
            Y_GAP = 200,
            X0 = 60,
            Y0 = 60;
        this.nodes.update((ns) =>
            ns.map((n) => {
                const l = layer[n.id] ?? 0;
                const col = layerNodes[l] ?? [];
                const i = col.indexOf(n.id);
                return { ...n, x: X0 + l * X_GAP, y: Y0 + i * Y_GAP };
            }),
        );
    }

    // ─── Private ──────────────────────────────────────────────────────────────
    private _revalidate() {
        const issues = validateGraph({ nodes: this.nodes(), edges: this.edges() });
        const errorIds = new Set(
            issues.filter((i) => i.level === 'error' && i.nodeId).map((i) => i.nodeId!),
        );
        const warnIds = new Set(
            issues.filter((i) => i.level === 'warn' && i.nodeId).map((i) => i.nodeId!),
        );
        this.nodes.update((ns) =>
            ns.map((n) => ({
                ...n,
                hasError: errorIds.has(n.id),
                hasWarning: warnIds.has(n.id),
            })),
        );
    }

    // ─── Type-check connection ────────────────────────────────────────────────
    isValidConnection(
        srcNodeId: string,
        srcPort: string,
        dstNodeId: string,
        dstPort: string,
    ): boolean {
        const srcNode = this.nodes().find((n) => n.id === srcNodeId);
        const dstNode = this.nodes().find((n) => n.id === dstNodeId);
        if (!srcNode || !dstNode || srcNodeId === dstNodeId) return false;

        const srcDef = NODE_BY_TYPE[srcNode.type];
        const dstDef = NODE_BY_TYPE[dstNode.type];
        const srcPortDef = srcDef?.outputs.find((p) => p.name === srcPort);
        const dstPortDef = dstDef?.inputs.find((p) => p.name === dstPort);
        if (!srcPortDef || !dstPortDef) return false;

        if (srcPortDef.dtype === 'ANY' || dstPortDef.dtype === 'ANY') return true;
        return srcPortDef.dtype === dstPortDef.dtype;
    }

    edgeColor(srcNodeId: string, srcPort: string): string {
        const node = this.nodes().find((n) => n.id === srcNodeId);
        if (!node) return '#64748b';
        const def = NODE_BY_TYPE[node.type];
        const port = def?.outputs.find((p) => p.name === srcPort);
        return port ? (DTYPE_COLORS[port.dtype as DType] ?? '#64748b') : '#64748b';
    }

    nodeBorderColor(nodeId: string): string {
        const node = this.nodes().find((n) => n.id === nodeId);
        if (!node) return '#64748b';
        const def = NODE_BY_TYPE[node.type];
        // use first output port as example for border color
        const port = def?.outputs?.[0];
        return port ? (DTYPE_COLORS[port.dtype as DType] ?? '#64748b') : '#64748b';
    }
}
