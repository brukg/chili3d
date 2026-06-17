// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { EditableShapeNode, type IDocument, type IEdge, type INode, Result } from "@chili3d/core";

export type DxfEntity =
    | { type: "line"; x1: number; y1: number; x2: number; y2: number }
    | { type: "circle"; cx: number; cy: number; r: number }
    | { type: "arc"; cx: number; cy: number; r: number; start: number; end: number };

const KNOWN = new Set(["LINE", "CIRCLE", "ARC"]);

/**
 * Parse a DXF file's LINE / CIRCLE / ARC entities. DXF is a stream of (group-code, value) line pairs;
 * code 0 starts a new entity, 10/20 are the primary point (line start or centre), 11/21 the line end,
 * 40 the radius, 50/51 the arc start/end angle (degrees). Other entities are ignored.
 */
export function parseDxf(text: string): DxfEntity[] {
    const lines = text.split(/\r?\n/);
    const entities: DxfEntity[] = [];
    let type: string | null = null;
    let codes: Record<number, number> = {};

    const flush = () => {
        if (!type) return;
        const c = codes;
        if (type === "LINE") {
            entities.push({ type: "line", x1: c[10] ?? 0, y1: c[20] ?? 0, x2: c[11] ?? 0, y2: c[21] ?? 0 });
        } else if (type === "CIRCLE") {
            entities.push({ type: "circle", cx: c[10] ?? 0, cy: c[20] ?? 0, r: c[40] ?? 0 });
        } else if (type === "ARC") {
            entities.push({
                type: "arc",
                cx: c[10] ?? 0,
                cy: c[20] ?? 0,
                r: c[40] ?? 0,
                start: c[50] ?? 0,
                end: c[51] ?? 0,
            });
        }
        type = null;
        codes = {};
    };

    for (let i = 0; i + 1 < lines.length; i += 2) {
        const code = Number.parseInt(lines[i].trim(), 10);
        const value = lines[i + 1].trim();
        if (Number.isNaN(code)) continue;
        if (code === 0) {
            flush();
            const t = value.toUpperCase();
            type = KNOWN.has(t) ? t : null;
        } else if (type) {
            codes[code] = Number(value);
        }
    }
    flush();
    return entities;
}

/** Import a DXF file's 2D geometry (in the XY plane) as a compound of edges in an EditableShapeNode. */
export function importDxf(document: IDocument, name: string, text: string): Result<INode> {
    const edges: IEdge[] = [];
    const z = 0;
    for (const e of parseDxf(text)) {
        let result: Result<IEdge> | undefined;
        if (e.type === "line") {
            result = shapeFactory.line({ x: e.x1, y: e.y1, z }, { x: e.x2, y: e.y2, z });
        } else if (e.type === "circle") {
            result = shapeFactory.circle({ x: 0, y: 0, z: 1 }, { x: e.cx, y: e.cy, z }, e.r);
        } else {
            const a = (e.start * Math.PI) / 180;
            const startPt = { x: e.cx + e.r * Math.cos(a), y: e.cy + e.r * Math.sin(a), z };
            let sweep = e.end - e.start;
            if (sweep <= 0) sweep += 360; // DXF arcs run counter-clockwise
            result = shapeFactory.arc({ x: 0, y: 0, z: 1 }, { x: e.cx, y: e.cy, z }, startPt, sweep);
        }
        if (result?.isOk) edges.push(result.value);
    }

    if (edges.length === 0) {
        return Result.err("DXF contains no supported entities (LINE/CIRCLE/ARC)");
    }
    const compound = shapeFactory.combine(edges);
    if (!compound.isOk) {
        return Result.err(compound.error);
    }
    return Result.ok(new EditableShapeNode({ document, name, shape: compound.value }));
}
