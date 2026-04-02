// XML serialisation - matches the Python graph.to_dict() schema.
// Format:
//   <graph>
//     <node id="..." type="..." label="..." x="..." y="...">
//       <param name="..." value="..." />
//     </node>
//     <edge src_node="..." src_port="..." dst_node="..." dst_port="..." />
//   </graph>
import { DOMParser } from 'xmldom';

import { NODE_BY_TYPE } from './node-registry';

export type SerializedParam = { name: string; value: string };

export type SerializedNode = {
    id: string;
    type: string;
    label: string;
    x: number;
    y: number;
    params: SerializedParam[];
};

export type SerializedEdge = {
    src_node: string;
    src_port: string;
    dst_node: string;
    dst_port: string;
};

export type SerializedGraph = {
    nodes: SerializedNode[];
    edges: SerializedEdge[];
};

// ─── Serialise to XML ────────────────────────────────────────────────────────

export function graphToXml(graph: SerializedGraph): string {
    const nodeLines = graph.nodes.map((n) => {
        const paramLines = n.params.map(
            (p) => `      <span data-name="${esc(p.name)}" data-value="${esc(p.value)}"></span>`,
        );
        const inner = paramLines.length > 0 ? `\n${paramLines.join('\n')}\n    ` : '';
        return `    <node id="${esc(n.id)}" type="${esc(n.type)}" label="${esc(n.label)}" x="${n.x.toFixed(1)}" y="${n.y.toFixed(1)}">${inner}</node>`;
    });

    const edgeLines = graph.edges.map(
        (e) =>
            `    <edge src_node="${esc(e.src_node)}" src_port="${esc(e.src_port)}" dst_node="${esc(e.dst_node)}" dst_port="${esc(e.dst_port)}" />`,
    );

    return [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<graph>`,
        ...nodeLines,
        ...(edgeLines.length > 0 ? ['', ...edgeLines] : []),
        `</graph>`,
    ].join('\n');
}

function esc(s: string): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ─── Parse from XML ──────────────────────────────────────────────────────────

export function xmlToGraph(xml: string): SerializedGraph {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');

    const parseErr = doc.getElementsByTagName('parsererror')[0];
    if (parseErr) throw new Error('XML parse error: ' + parseErr.textContent);

    const nodes: SerializedNode[] = [];
    const nodeEls = doc.getElementsByTagName('node');
    for (let i = 0; i < nodeEls.length; i++) {
        const el = nodeEls[i];
        const params: SerializedParam[] = [];
        const paramEls = el.getElementsByTagName('param');
        for (let j = 0; j < paramEls.length; j++) {
            const p = paramEls[j];
            params.push({
                name: p.getAttribute('name') ?? '',
                value: p.getAttribute('value') ?? '',
            });
        }
        nodes.push({
            id: el.getAttribute('id') ?? '',
            type: el.getAttribute('type') ?? '',
            label: el.getAttribute('label') ?? '',
            x: parseFloat(el.getAttribute('x') ?? '0'),
            y: parseFloat(el.getAttribute('y') ?? '0'),
            params,
        });
    }

    const edges: SerializedEdge[] = [];
    const edgeEls = doc.getElementsByTagName('edge');
    for (let i = 0; i < edgeEls.length; i++) {
        const el = edgeEls[i];
        edges.push({
            src_node: el.getAttribute('src_node') ?? '',
            src_port: el.getAttribute('src_port') ?? '',
            dst_node: el.getAttribute('dst_node') ?? '',
            dst_port: el.getAttribute('dst_port') ?? '',
        });
    }

    return { nodes, edges };
}

// ─── Validate graph structure ─────────────────────────────────────────────────

export type ValidationIssue = {
    level: 'error' | 'warn';
    message: string;
    nodeId?: string;
};

export function validateGraph(graph: SerializedGraph): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const nodeIds = new Set(graph.nodes.map((n) => n.id));

    // Unknown node types
    for (const n of graph.nodes) {
        if (!NODE_BY_TYPE[n.type]) {
            issues.push({ level: 'error', message: `Unknown node type: ${n.type}`, nodeId: n.id });
        }
    }

    // Dangling edge references
    for (const e of graph.edges) {
        if (!nodeIds.has(e.src_node)) {
            issues.push({ level: 'error', message: `Edge references missing node: ${e.src_node}` });
        }
        if (!nodeIds.has(e.dst_node)) {
            issues.push({ level: 'error', message: `Edge references missing node: ${e.dst_node}` });
        }
    }

    // Required input ports not connected
    const connectedDst = new Set(graph.edges.map((e) => `${e.dst_node}:${e.dst_port}`));
    for (const n of graph.nodes) {
        const def = NODE_BY_TYPE[n.type];
        if (!def) continue;
        for (const port of def.inputs) {
            if (port.required !== false) {
                const key = `${n.id}:${port.name}`;
                if (!connectedDst.has(key)) {
                    issues.push({
                        level: 'error',
                        message: `${n.label} (${n.type}): required input "${port.name}" not connected`,
                        nodeId: n.id,
                    });
                }
            }
        }
    }

    // Isolated nodes (no edges at all)
    const connectedNodes = new Set([
        ...graph.edges.map((e) => e.src_node),
        ...graph.edges.map((e) => e.dst_node),
    ]);
    for (const n of graph.nodes) {
        if (!connectedNodes.has(n.id)) {
            issues.push({ level: 'warn', message: `${n.label} has no connections`, nodeId: n.id });
        }
    }

    // No LOBSource
    if (!graph.nodes.some((n) => n.type === 'LOBSource')) {
        issues.push({
            level: 'warn',
            message: 'Graph has no LOBSource - strategy will have no market data',
        });
    }

    return issues;
}

// ─── Example graph (momentum crossover) ──────────────────────────────────────

export const EXAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<graph>
    <node id="src" type="LOBSource" label="market" x="60" y="220" />
    <node id="fast" type="EWMA" label="fast_ewma" x="340" y="120">
      <param name="span" value="5" />
      <param name="alpha" value="0" />
    </node>
    <node id="slow" type="EWMA" label="slow_ewma" x="340" y="320">
      <param name="span" value="20" />
      <param name="alpha" value="0" />
    </node>
    <node id="cross" type="Crossover" label="crossover" x="600" y="220" />
    <node id="inpos" type="BoolVariable" label="in_position" x="860" y="440">
      <param name="initial" value="false" />
    </node>
    <node id="notin" type="LogicGate" label="not_in_pos" x="860" y="220">
      <param name="op" value="not" />
    </node>
    <node id="buy_cd" type="Cooldown" label="buy_cooldown" x="860" y="80">
      <param name="n_ticks" value="5" />
    </node>
    <node id="sell_cd" type="Cooldown" label="sell_cooldown" x="860" y="360">
      <param name="n_ticks" value="5" />
    </node>
    <node id="buy_sz" type="Constant" label="buy_size" x="860" y="560">
      <param name="value" value="1.0" />
    </node>
    <node id="buy" type="LimitOrderGen" label="buy" x="1120" y="80">
      <param name="side" value="buy" />
      <param name="symbol" value="SIM" />
      <param name="tag" value="entry" />
    </node>
    <node id="sell" type="MarketOrderGen" label="sell" x="1120" y="360">
      <param name="side" value="sell" />
      <param name="symbol" value="SIM" />
    </node>

    <edge src_node="src"     src_port="mid"        dst_node="fast"    dst_port="value" />
    <edge src_node="src"     src_port="mid"        dst_node="slow"    dst_port="value" />
    <edge src_node="fast"    src_port="ewma"       dst_node="cross"   dst_port="a" />
    <edge src_node="slow"    src_port="ewma"       dst_node="cross"   dst_port="b" />
    <edge src_node="cross"   src_port="cross_up"   dst_node="buy_cd"  dst_port="trigger" />
    <edge src_node="cross"   src_port="cross_down" dst_node="sell_cd" dst_port="trigger" />
    <edge src_node="buy_cd"  src_port="fire"       dst_node="buy"     dst_port="trigger" />
    <edge src_node="inpos"   src_port="value"      dst_node="notin"   dst_port="a" />
    <edge src_node="notin"   src_port="result"     dst_node="buy"     dst_port="enabled" />
    <edge src_node="src"     src_port="best_ask"   dst_node="buy"     dst_port="price" />
    <edge src_node="buy_sz"  src_port="value"      dst_node="buy"     dst_port="size" />
    <edge src_node="sell_cd" src_port="fire"       dst_node="sell"    dst_port="trigger" />
    <edge src_node="inpos"   src_port="value"      dst_node="sell"    dst_port="enabled" />
    <edge src_node="buy_sz"  src_port="value"      dst_node="sell"    dst_port="size" />
    <edge src_node="buy"     src_port="fired"      dst_node="inpos"   dst_port="set" />
    <edge src_node="sell"    src_port="fired"      dst_node="inpos"   dst_port="clear" />
</graph>`;
