// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    download,
    GeometryNode,
    type IApplication,
    type ICommand,
    type INode,
    MeshNode,
    NodeUtils,
    PubSub,
} from "@chili3d/core";

export interface BomRow {
    item: number;
    name: string;
    quantity: number;
}

// Group body names into a bill-of-materials: one row per distinct name, with its quantity, numbered in
// alphabetical order. Pure (no document/kernel) so it is directly unit-testable.
export function buildBomRows(names: string[]): BomRow[] {
    const counts = new Map<string, number>();
    for (const name of names) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, quantity], i) => ({ item: i + 1, name, quantity }));
}

/** Serialise BOM rows to CSV, quoting any field that contains a comma, quote or newline. */
export function bomToCsv(rows: BomRow[]): string {
    const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const lines = ["Item,Name,Quantity"];
    for (const row of rows) {
        lines.push(`${row.item},${quote(row.name)},${row.quantity}`);
    }
    return `${lines.join("\n")}\n`;
}

// Export BOM (Fusion's bill of materials): walk the document tree, tally every body (B-rep or mesh) by
// name, and download the parts list as a CSV. Construction geometry and folders are not parts.
@command({
    key: "file.exportBom",
    icon: "icon-download",
})
export class ExportBom implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;

        const names: string[] = [];
        const walk = (node: INode) => {
            if (node instanceof GeometryNode || node instanceof MeshNode) {
                names.push(node.name);
            }
            if (NodeUtils.isLinkedListNode(node)) {
                let child = node.firstChild;
                while (child) {
                    walk(child);
                    child = child.nextSibling;
                }
            }
        };
        let child = document.modelManager.rootNode.firstChild;
        while (child) {
            walk(child);
            child = child.nextSibling;
        }

        if (names.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const csv = bomToCsv(buildBomRows(names));
        PubSub.default.pub("showToast", "toast.downloading");
        download([csv], `${document.name}_bom.csv`);
    }
}
