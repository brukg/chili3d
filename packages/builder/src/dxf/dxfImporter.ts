// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { computeArcFromPoints } from "@chili3d/app";
import { EditableShapeNode, type IDocument, type IEdge, type INode, Result, XYZ } from "@chili3d/core";

export type DxfEntity =
    | { type: "line"; x1: number; y1: number; x2: number; y2: number }
    | { type: "circle"; cx: number; cy: number; r: number }
    | { type: "arc"; cx: number; cy: number; r: number; start: number; end: number }
    | { type: "polyline"; vertices: { x: number; y: number; bulge: number }[]; closed: boolean }
    | { type: "ellipse"; cx: number; cy: number; mx: number; my: number; ratio: number; sweep: number };

const KNOWN = new Set(["LINE", "CIRCLE", "ARC", "LWPOLYLINE", "ELLIPSE"]);

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
    // LWPOLYLINE repeats codes 10/20 per vertex, so it needs its own accumulator.
    let poly: { vertices: { x: number; y: number; bulge: number }[]; closed: boolean } | null = null;

    const flush = () => {
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
        } else if (type === "LWPOLYLINE" && poly && poly.vertices.length >= 2) {
            entities.push({ type: "polyline", vertices: poly.vertices, closed: poly.closed });
        } else if (type === "ELLIPSE") {
            entities.push({
                type: "ellipse",
                cx: c[10] ?? 0,
                cy: c[20] ?? 0,
                mx: c[11] ?? 0,
                my: c[21] ?? 0,
                ratio: c[40] ?? 1,
                sweep: Math.abs((c[42] ?? 0) - (c[41] ?? 0)), // 0 ⇒ params omitted ⇒ full ellipse
            });
        }
        type = null;
        codes = {};
        poly = null;
    };

    for (let i = 0; i + 1 < lines.length; i += 2) {
        const code = Number.parseInt(lines[i].trim(), 10);
        const value = lines[i + 1].trim();
        if (Number.isNaN(code)) continue;
        if (code === 0) {
            flush();
            const t = value.toUpperCase();
            type = KNOWN.has(t) ? t : null;
            if (type === "LWPOLYLINE") poly = { vertices: [], closed: false };
        } else if (type === "LWPOLYLINE" && poly) {
            const n = Number(value);
            const last = poly.vertices[poly.vertices.length - 1];
            if (code === 70) poly.closed = (n & 1) === 1;
            else if (code === 10) poly.vertices.push({ x: n, y: 0, bulge: 0 });
            else if (code === 20 && last) last.y = n;
            else if (code === 42 && last) last.bulge = n; // arc bulge for the segment after this vertex
        } else if (type) {
            codes[code] = Number(value);
        }
    }
    flush();
    return entities;
}

// Build an arc edge for a bulged polyline segment. A DXF bulge is tan(θ/4): the arc apex sits a
// sagitta of bulge·(chord/2) off the chord midpoint, perpendicular to the chord. Reuses the proven
// 3-point arc recipe (apex → computeArcFromPoints → shapeFactory.arc).
function bulgeArc(ax: number, ay: number, bx: number, by: number, bulge: number): Result<IEdge> | undefined {
    const z = 0;
    const cx = bx - ax;
    const cy = by - ay;
    const len = Math.hypot(cx, cy);
    if (len < 1e-9) return undefined;
    const nx = -cy / len; // unit left-normal of the chord a→b
    const ny = cx / len;
    const sag = (bulge * len) / 2;
    const apex = new XYZ({ x: (ax + bx) / 2 + nx * sag, y: (ay + by) / 2 + ny * sag, z });
    const a = new XYZ({ x: ax, y: ay, z });
    const b = new XYZ({ x: bx, y: by, z });
    const params = computeArcFromPoints(a, apex, b);
    if (!params) return shapeFactory.line(a, b);
    return shapeFactory.arc(params.normal, params.center, params.start, params.angle);
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
        } else if (e.type === "polyline") {
            const n = e.vertices.length;
            const segments = e.closed ? n : n - 1;
            for (let i = 0; i < segments; i++) {
                const a = e.vertices[i];
                const b = e.vertices[(i + 1) % n];
                const seg =
                    Math.abs(a.bulge) > 1e-9
                        ? bulgeArc(a.x, a.y, b.x, b.y, a.bulge)
                        : shapeFactory.line({ x: a.x, y: a.y, z }, { x: b.x, y: b.y, z });
                if (seg?.isOk) edges.push(seg.value);
            }
            continue;
        } else if (e.type === "ellipse") {
            const majorR = Math.hypot(e.mx, e.my);
            // Only full ellipses are built; partial ellipse arcs (a non-2π sweep) are skipped.
            if (majorR < 1e-9 || (e.sweep > 1e-9 && Math.abs(e.sweep - 2 * Math.PI) > 1e-3)) continue;
            const el = shapeFactory.ellipse(
                { x: 0, y: 0, z: 1 },
                { x: e.cx, y: e.cy, z },
                { x: e.mx / majorR, y: e.my / majorR, z },
                majorR,
                majorR * e.ratio,
            );
            if (el.isOk) edges.push(el.value);
            continue;
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
