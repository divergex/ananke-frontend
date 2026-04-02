import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NODE_BY_TYPE, DTYPE_COLORS, type DType } from '@lib/node-registry';
import { GraphService } from '@services/graph';

/**
 * PropertiesComponent displays the details and editable properties of the
 * currently selected node in the graph editor.
 *
 * Shows node identity, label, parameters (with appropriate input types),
 * input/output ports, and description. Allows updating parameters, changing
 * labels, deleting the node, and deselecting the node via GraphService.
 */
@Component({
    selector: 'app-properties',
    standalone: true,
    imports: [FormsModule],
    template: `
        @let node = graph.selectedNode();
        @if (node) {
            @let def = nodeDef(node.type);
            <aside class="props">
                <div class="props-header">
                    <span class="section-label" style="flex:1">Properties</span>
                    <button
                        class="icon-btn danger"
                        title="Delete node"
                        (click)="graph.deleteNode(node.id)"
                    >
                        🗑
                    </button>
                    <button class="icon-btn" (click)="graph.selectNode(null)">✕</button>
                </div>

                <div class="props-body">
                    <!-- Identity -->
                    <div class="section">
                        <p class="section-label">Identity</p>
                        <div class="field">
                            <label class="field-label">Type</label>
                            <span class="mono-value">{{ node.type }}</span>
                        </div>
                        <div class="field">
                            <label class="field-label">Label</label>
                            <input
                                class="field-input"
                                [value]="node.label"
                                (input)="graph.updateLabel(node.id, asInput($event))"
                            />
                        </div>
                        <div class="field">
                            <label class="field-label">ID</label>
                            <span class="mono-value tiny">{{ node.id }}</span>
                        </div>
                    </div>

                    <!-- Params -->
                    @if (def && def.params.length > 0) {
                        <div class="section">
                            <p class="section-label">Parameters</p>
                            @for (param of def.params; track param.name) {
                                @let pval = getParam(node, param.name, String(param.default));
                                <div class="field">
                                    <label class="field-label" [title]="param.doc ?? ''">{{
                                        param.name
                                    }}</label>
                                    @if (param.type === 'select') {
                                        <select
                                            class="field-input"
                                            [value]="pval"
                                            (change)="
                                                graph.updateParam(
                                                    node.id,
                                                    param.name,
                                                    asInput($event)
                                                )
                                            "
                                        >
                                            @for (opt of param.options ?? []; track opt) {
                                                <option [value]="opt" [selected]="opt === pval">
                                                    {{ opt }}
                                                </option>
                                            }
                                        </select>
                                    } @else if (param.type === 'boolean') {
                                        <label class="bool-label">
                                            <input
                                                type="checkbox"
                                                [checked]="pval === 'true'"
                                                (change)="
                                                    graph.updateParam(
                                                        node.id,
                                                        param.name,
                                                        asBool($event)
                                                    )
                                                "
                                            />
                                            <span class="bool-text">{{
                                                pval === 'true' ? 'true' : 'false'
                                            }}</span>
                                        </label>
                                    } @else {
                                        <input
                                            class="field-input mono"
                                            [type]="param.type === 'number' ? 'number' : 'text'"
                                            [value]="pval"
                                            (input)="
                                                graph.updateParam(
                                                    node.id,
                                                    param.name,
                                                    asInput($event)
                                                )
                                            "
                                            step="any"
                                        />
                                    }
                                    @if (param.doc) {
                                        <span class="field-doc">{{ param.doc }}</span>
                                    }
                                </div>
                            }
                        </div>
                    }

                    <!-- Input ports -->
                    @if (def && def.inputs.length > 0) {
                        <div class="section">
                            <p class="section-label">Input Ports</p>
                            @for (port of def.inputs; track port.name) {
                                <div class="port-row">
                                    <span
                                        class="port-dot"
                                        [style.background]="dtypeColor(port.dtype)"
                                    ></span>
                                    <span class="port-name">{{ port.name }}</span>
                                    <span
                                        class="port-badge"
                                        [style.background]="dtypeColor(port.dtype) + '25'"
                                        [style.color]="dtypeColor(port.dtype)"
                                        >{{ port.dtype }}</span
                                    >
                                    @if (port.required === false) {
                                        <span class="port-opt">opt</span>
                                    }
                                </div>
                            }
                        </div>
                    }

                    <!-- Output ports -->
                    @if (def && def.outputs.length > 0) {
                        <div class="section">
                            <p class="section-label">Output Ports</p>
                            @for (port of def.outputs; track port.name) {
                                <div class="port-row">
                                    <span
                                        class="port-dot"
                                        [style.background]="dtypeColor(port.dtype)"
                                    ></span>
                                    <span class="port-name">{{ port.name }}</span>
                                    <span
                                        class="port-badge"
                                        [style.background]="dtypeColor(port.dtype) + '25'"
                                        [style.color]="dtypeColor(port.dtype)"
                                        >{{ port.dtype }}</span
                                    >
                                </div>
                            }
                        </div>
                    }

                    <!-- Description -->
                    @if (def) {
                        <div class="section">
                            <p class="section-label">Description</p>
                            <p class="desc-text">{{ def.description }}</p>
                        </div>
                    }
                </div>
            </aside>
        }
    `,
    styles: [
        `
            :host {
                display: contents;
            }
            .props {
                width: 248px;
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                border-left: 1px solid #1e293b;
                background: #070d19;
                overflow: hidden;
            }
            .props-header {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 8px 10px;
                border-bottom: 1px solid #1e293b;
            }
            .props-body {
                flex: 1;
                overflow-y: auto;
            }

            .section {
                border-bottom: 1px solid #111827;
                padding: 10px;
            }
            .section-label {
                font-size: 9px;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: #374151;
                font-weight: 700;
                margin: 0 0 8px;
                display: block;
            }

            .field {
                margin-bottom: 8px;
            }
            .field-label {
                display: block;
                font-size: 10px;
                color: #64748b;
                font-weight: 500;
                margin-bottom: 3px;
            }
            .field-doc {
                display: block;
                font-size: 9px;
                color: #374151;
                margin-top: 2px;
            }
            .field-input {
                width: 100%;
                background: #0f172a;
                border: 1px solid #1e293b;
                border-radius: 4px;
                padding: 4px 7px;
                font-size: 11px;
                color: #e2e8f0;
                outline: none;
                font-family: monospace;
            }
            .field-input:focus {
                border-color: #334155;
            }
            .field-input.mono {
                font-family: monospace;
            }

            .mono-value {
                font-size: 11px;
                color: #64748b;
                font-family: monospace;
                word-break: break-all;
            }
            .mono-value.tiny {
                font-size: 9px;
                color: #334155;
            }

            .bool-label {
                display: flex;
                align-items: center;
                gap: 7px;
                cursor: pointer;
            }
            .bool-label input {
                accent-color: #3b82f6;
            }
            .bool-text {
                font-size: 11px;
                color: #94a3b8;
                font-family: monospace;
            }

            .port-row {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 5px;
            }
            .port-dot {
                width: 8px;
                height: 8px;
                border-radius: 2px;
                flex-shrink: 0;
            }
            .port-name {
                font-size: 10px;
                color: #cbd5e1;
                font-family: monospace;
                flex: 1;
            }
            .port-badge {
                font-size: 8px;
                padding: 1px 5px;
                border-radius: 3px;
                font-weight: 700;
            }
            .port-opt {
                font-size: 9px;
                color: #374151;
            }

            .desc-text {
                font-size: 11px;
                color: #64748b;
                line-height: 1.6;
                margin: 0;
            }

            .icon-btn {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                background: transparent;
                color: #475569;
                cursor: pointer;
                border-radius: 4px;
                font-size: 12px;
                transition:
                    background 0.1s,
                    color 0.1s;
            }
            .icon-btn:hover {
                background: #1e293b;
                color: #e2e8f0;
            }
            .icon-btn.danger:hover {
                color: #f87171;
                background: rgba(239, 68, 68, 0.1);
            }
        `,
    ],
})
export class PropertiesComponent {
    graph = inject(GraphService);

    nodeDef(type: string) {
        return NODE_BY_TYPE[type] ?? null;
    }
    dtypeColor(dtype: string) {
        return DTYPE_COLORS[dtype as DType] ?? '#6b7280';
    }

    getParam(node: any, name: string, fallback: string): string {
        return node.params.find((p: any) => p.name === name)?.value ?? fallback;
    }

    asInput(e: Event): string {
        return (e.target as HTMLInputElement | HTMLSelectElement).value;
    }
    asBool(e: Event): string {
        return String((e.target as HTMLInputElement).checked);
    }

    protected readonly String = String;
}
