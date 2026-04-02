import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GraphService } from '@services/graph';

/**
 * XmlPanelComponent displays a modal for viewing and editing the graph's XML.
 *
 * Provides two tabs: "Export" for copying or downloading the current graph XML,
 * and "Import" for loading XML from a file or text input. Shows validation badges
 * and issues from the GraphService. Interacts with GraphService signals to read
 * and update graph data and control panel visibility.
 */
@Component({
    selector: 'app-xml-panel',
    standalone: true,
    imports: [FormsModule],
    template: `
        <div class="backdrop" (click)="close($event)">
            <div class="modal" (click)="$event.stopPropagation()">
                <!-- Header -->
                <div class="modal-header">
                    <span class="modal-title">Graph XML</span>

                    @let ec = graph.errorCount();
                    @let wc = graph.warningCount();
                    @if (ec > 0) {
                        <span class="badge error">✕ {{ ec }} error{{ ec > 1 ? 's' : '' }}</span>
                    } @else if (wc > 0) {
                        <span class="badge warn">⚠ {{ wc }} warning{{ wc > 1 ? 's' : '' }}</span>
                    } @else {
                        <span class="badge ok">✓ valid</span>
                    }

                    <!-- Tab switcher -->
                    <div class="tabs">
                        <button
                            class="tab"
                            [class.active]="tab() === 'export'"
                            (click)="setTab('export')"
                        >
                            Export
                        </button>
                        <button
                            class="tab"
                            [class.active]="tab() === 'import'"
                            (click)="setTab('import')"
                        >
                            Import
                        </button>
                    </div>

                    <button class="close-btn" (click)="graph.showXmlPanel.set(false)">✕</button>
                </div>

                <!-- Validation issues -->
                @if (graph.issues().length > 0) {
                    <div class="issues">
                        @for (issue of graph.issues(); track $index) {
                            <div
                                class="issue"
                                [class.error]="issue.level === 'error'"
                                [class.warn]="issue.level === 'warn'"
                            >
                                {{ issue.level === 'error' ? '✕' : '⚠' }} {{ issue.message }}
                            </div>
                        }
                    </div>
                }

                <!-- XML textarea -->
                <textarea
                    class="xml-area"
                    spellcheck="false"
                    [value]="tab() === 'export' ? graph.currentXml() : importText()"
                    [readonly]="tab() === 'export'"
                    (input)="importText.set(asInput($event))"
                ></textarea>

                <!-- Footer -->
                <div class="modal-footer">
                    @if (tab() === 'export') {
                        <button class="action-btn" (click)="copy()">
                            {{ copied() ? '✓ Copied' : '⎘ Copy' }}
                        </button>
                        <button class="action-btn" (click)="download()">↓ Download .xml</button>
                    } @else {
                        <label class="action-btn file-label">
                            ↑ Load file
                            <input
                                type="file"
                                accept=".xml"
                                class="hidden-file"
                                (change)="loadFile($event)"
                            />
                        </label>
                        <button class="action-btn primary" (click)="applyImport()">
                            Apply graph
                        </button>
                    }
                    <button class="close-text" (click)="close($event)">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            .backdrop {
                position: fixed;
                inset: 0;
                z-index: 100;
                background: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .modal {
                width: 740px;
                max-height: 82vh;
                border-radius: 12px;
                border: 1px solid #1e293b;
                background: #070d19;
                display: flex;
                flex-direction: column;
                box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
                overflow: hidden;
            }
            .modal-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 16px;
                border-bottom: 1px solid #1e293b;
                flex-shrink: 0;
            }
            .modal-title {
                font-size: 13px;
                font-weight: 600;
                color: #e2e8f0;
            }
            .close-btn {
                margin-left: 8px;
                background: none;
                border: none;
                color: #475569;
                cursor: pointer;
                font-size: 14px;
                padding: 2px 6px;
                border-radius: 4px;
            }
            .close-btn:hover {
                color: #e2e8f0;
                background: #1e293b;
            }

            .badge {
                font-size: 10px;
                padding: 2px 8px;
                border-radius: 12px;
                border: 1px solid;
                font-family: monospace;
            }
            .badge.error {
                color: #f87171;
                border-color: #7f1d1d;
                background: rgba(127, 29, 29, 0.3);
            }
            .badge.warn {
                color: #fbbf24;
                border-color: #78350f;
                background: rgba(120, 53, 15, 0.3);
            }
            .badge.ok {
                color: #34d399;
                border-color: #064e3b;
                background: rgba(6, 78, 59, 0.2);
            }

            .tabs {
                display: flex;
                background: #0f172a;
                border-radius: 6px;
                padding: 2px;
                margin-left: auto;
            }
            .tab {
                padding: 4px 12px;
                font-size: 11px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                background: transparent;
                color: #64748b;
                font-family: monospace;
                transition:
                    background 0.1s,
                    color 0.1s;
            }
            .tab.active {
                background: #1e293b;
                color: #e2e8f0;
            }

            .issues {
                padding: 8px 16px;
                border-bottom: 1px solid #1e293b;
                max-height: 100px;
                overflow-y: auto;
                flex-shrink: 0;
            }
            .issue {
                font-size: 11px;
                margin-bottom: 3px;
                font-family: monospace;
            }
            .issue.error {
                color: #f87171;
            }
            .issue.warn {
                color: #fbbf24;
            }

            .xml-area {
                flex: 1;
                width: 100%;
                min-height: 300px;
                resize: none;
                background: rgba(15, 23, 42, 0.6);
                border: none;
                outline: none;
                font-family: monospace;
                font-size: 11px;
                color: #94a3b8;
                padding: 16px;
                line-height: 1.7;
            }

            .modal-footer {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 16px;
                border-top: 1px solid #1e293b;
                flex-shrink: 0;
            }
            .action-btn {
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 5px 12px;
                border-radius: 5px;
                font-size: 11px;
                cursor: pointer;
                border: 1px solid #334155;
                background: transparent;
                color: #cbd5e1;
                font-family: monospace;
                transition: background 0.1s;
            }
            .action-btn:hover {
                background: #1e293b;
            }
            .action-btn.primary {
                background: #1d4ed8;
                border-color: #1d4ed8;
                color: #fff;
            }
            .action-btn.primary:hover {
                background: #2563eb;
            }
            .file-label {
                cursor: pointer;
            }
            .hidden-file {
                display: none;
            }
            .close-text {
                margin-left: auto;
                font-size: 11px;
                color: #475569;
                cursor: pointer;
                background: none;
                border: none;
                font-family: monospace;
            }
            .close-text:hover {
                color: #94a3b8;
            }
        `,
    ],
})
export class XmlPanelComponent {
    graph = inject(GraphService);
    tab = signal<'export' | 'import'>('export');
    importText = signal('');
    copied = signal(false);

    setTab(t: 'export' | 'import') {
        this.tab.set(t);
        if (t === 'import') this.importText.set(this.graph.currentXml());
    }

    close(_: Event) {
        this.graph.showXmlPanel.set(false);
    }

    copy() {
        navigator.clipboard.writeText(this.graph.currentXml());
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 1500);
    }

    download() {
        const blob = new Blob([this.graph.currentXml()], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'strategy.xml';
        a.click();
        URL.revokeObjectURL(url);
    }

    loadFile(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) file.text().then((t) => this.importText.set(t));
    }

    applyImport() {
        try {
            this.graph.loadXml(this.importText());
            this.graph.showXmlPanel.set(false);
        } catch (err) {
            alert('XML parse error:\n' + (err as Error).message);
        }
    }

    asInput(e: Event): string {
        return (e.target as HTMLTextAreaElement).value;
    }
}
