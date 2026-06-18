// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { EditableShapeNode, type IDocument, type IEdge, type INode, Result } from "@chili3d/core";

// SVG geometry, already converted to CAD coordinates (SVG y points down, so y is negated). A "cubic"
// carries its four control points (p0 = start, p3 = end) for shapeFactory.bezier.
export type SvgEntity =
    | { type: "line"; x1: number; y1: number; x2: number; y2: number }
    | { type: "cubic"; points: { x: number; y: number }[] }
    | { type: "circle"; cx: number; cy: number; r: number }
    | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number };

const NUM = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;
const numbers = (s: string): number[] => (s.match(NUM) ?? []).map(Number);
const attr = (tag: string, name: string): number => {
    const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`));
    return m ? Number.parseFloat(m[1]) : 0;
};

// Parse an SVG document's drawable geometry. Supports <path> (M/L/H/V/C/S/Q/T/A/Z, absolute + relative) and
// the <line>/<polyline>/<polygon>/<rect>/<circle>/<ellipse> elements. SVG y is flipped to CAD y.
export function parseSvg(text: string): SvgEntity[] {
    const out: SvgEntity[] = [];
    const Y = (y: number) => -y; // flip to CAD orientation

    for (const tag of text.match(/<(path|line|polyline|polygon|rect|circle|ellipse)\b[^>]*>/g) ?? []) {
        const name = tag.match(/<(\w+)/)![1];
        if (name === "line") {
            out.push({
                type: "line",
                x1: attr(tag, "x1"),
                y1: Y(attr(tag, "y1")),
                x2: attr(tag, "x2"),
                y2: Y(attr(tag, "y2")),
            });
        } else if (name === "circle") {
            out.push({ type: "circle", cx: attr(tag, "cx"), cy: Y(attr(tag, "cy")), r: attr(tag, "r") });
        } else if (name === "ellipse") {
            out.push({
                type: "ellipse",
                cx: attr(tag, "cx"),
                cy: Y(attr(tag, "cy")),
                rx: attr(tag, "rx"),
                ry: attr(tag, "ry"),
            });
        } else if (name === "rect") {
            const x = attr(tag, "x");
            const y = attr(tag, "y");
            const w = attr(tag, "width");
            const h = attr(tag, "height");
            const pts = [
                { x, y: Y(y) },
                { x: x + w, y: Y(y) },
                { x: x + w, y: Y(y + h) },
                { x, y: Y(y + h) },
            ];
            for (let i = 0; i < 4; i++) {
                const a = pts[i];
                const b = pts[(i + 1) % 4];
                out.push({ type: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y });
            }
        } else if (name === "polyline" || name === "polygon") {
            const m = tag.match(/points\s*=\s*"([^"]*)"/);
            const v = m ? numbers(m[1]) : [];
            const pts: { x: number; y: number }[] = [];
            for (let i = 0; i + 1 < v.length; i += 2) pts.push({ x: v[i], y: Y(v[i + 1]) });
            const segs = name === "polygon" ? pts.length : pts.length - 1;
            for (let i = 0; i < segs; i++) {
                const a = pts[i];
                const b = pts[(i + 1) % pts.length];
                out.push({ type: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y });
            }
        } else {
            const m = tag.match(/\bd\s*=\s*"([^"]*)"/);
            if (m) parsePath(m[1], Y, out);
        }
    }
    return out;
}

// Approximate an SVG elliptical-arc (endpoint parametrization) with cubic Beziers (≤90° each). Returns
// control-point quads [p0,c1,c2,p3] in SVG space — point-based, so the importer's y-flip applies cleanly.
export function arcToBeziers(
    x1: number,
    y1: number,
    rx: number,
    ry: number,
    phi: number,
    fA: boolean,
    fS: boolean,
    x2: number,
    y2: number,
): { x: number; y: number }[][] {
    if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [];
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const dx = (x1 - x2) / 2;
    const dy = (y1 - y2) / 2;
    const x1p = cosP * dx + sinP * dy;
    const y1p = -sinP * dx + cosP * dy;
    const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lambda > 1) {
        const s = Math.sqrt(lambda);
        rx *= s;
        ry *= s;
    }
    const num = Math.max(0, rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p);
    const denom = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    const coef = (fA !== fS ? 1 : -1) * Math.sqrt(num / denom);
    const cxp = (coef * (rx * y1p)) / ry;
    const cyp = (-coef * (ry * x1p)) / rx;
    const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
    const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;

    const ang = (ux: number, uy: number, vx: number, vy: number) => {
        const dot = ux * vx + uy * vy;
        const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
        let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
        if (ux * vy - uy * vx < 0) a = -a;
        return a;
    };
    const theta1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dtheta =
        ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry) % (2 * Math.PI);
    if (!fS && dtheta > 0) dtheta -= 2 * Math.PI;
    if (fS && dtheta < 0) dtheta += 2 * Math.PI;

    const point = (t: number) => ({
        x: cx + rx * Math.cos(t) * cosP - ry * Math.sin(t) * sinP,
        y: cy + rx * Math.cos(t) * sinP + ry * Math.sin(t) * cosP,
    });
    const deriv = (t: number) => ({
        x: -rx * Math.sin(t) * cosP - ry * Math.cos(t) * sinP,
        y: -rx * Math.sin(t) * sinP + ry * Math.cos(t) * cosP,
    });

    const segs = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / 2)));
    const delta = dtheta / segs;
    const out: { x: number; y: number }[][] = [];
    for (let i = 0; i < segs; i++) {
        const a1 = theta1 + i * delta;
        const a2 = a1 + delta;
        const k = (4 / 3) * Math.tan((a2 - a1) / 4);
        const p1 = point(a1);
        const p2 = point(a2);
        const d1 = deriv(a1);
        const d2 = deriv(a2);
        out.push([
            p1,
            { x: p1.x + k * d1.x, y: p1.y + k * d1.y },
            { x: p2.x - k * d2.x, y: p2.y - k * d2.y },
            p2,
        ]);
    }
    return out;
}

// Parse one <path> data string. Tracks the current point and subpath start; relative commands (lowercase)
// add to the current point. A quadratic (Q) is promoted to a cubic; an arc (A) to cubic Beziers.
function parsePath(d: string, Y: (y: number) => number, out: SvgEntity[]) {
    let cx = 0;
    let cy = 0; // current point in SVG coords (y not yet flipped)
    let sx = 0;
    let sy = 0; // subpath start
    let prevCmd = ""; // previous command (uppercased) — drives S/T control-point reflection
    let lastCubicX = 0; // last cubic second control point, in un-flipped SVG coords
    let lastCubicY = 0;
    let lastQuadX = 0; // last quadratic control point, in un-flipped SVG coords
    let lastQuadY = 0;
    const line = (x2: number, y2: number) => out.push({ type: "line", x1: cx, y1: Y(cy), x2, y2: Y(y2) });

    for (const [, cmd, argStr] of d.matchAll(/([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g)) {
        const a = numbers(argStr);
        const rel = cmd === cmd.toLowerCase();
        if (cmd === "M" || cmd === "m") {
            cx = (rel ? cx : 0) + a[0];
            cy = (rel ? cy : 0) + a[1];
            sx = cx;
            sy = cy;
            // Extra coordinate pairs after a moveto are implicit linetos.
            for (let i = 2; i + 1 < a.length; i += 2) {
                const nx = (rel ? cx : 0) + a[i];
                const ny = (rel ? cy : 0) + a[i + 1];
                line(nx, ny);
                cx = nx;
                cy = ny;
            }
        } else if (cmd === "L" || cmd === "l") {
            for (let i = 0; i + 1 < a.length; i += 2) {
                const nx = (rel ? cx : 0) + a[i];
                const ny = (rel ? cy : 0) + a[i + 1];
                line(nx, ny);
                cx = nx;
                cy = ny;
            }
        } else if (cmd === "H" || cmd === "h") {
            for (const v of a) {
                const nx = (rel ? cx : 0) + v;
                line(nx, cy);
                cx = nx;
            }
        } else if (cmd === "V" || cmd === "v") {
            for (const v of a) {
                const ny = (rel ? cy : 0) + v;
                line(cx, ny);
                cy = ny;
            }
        } else if (cmd === "C" || cmd === "c") {
            for (let i = 0; i + 5 < a.length; i += 6) {
                const b = rel ? cx : 0;
                const c = rel ? cy : 0;
                const p = [
                    { x: cx, y: Y(cy) },
                    { x: b + a[i], y: Y(c + a[i + 1]) },
                    { x: b + a[i + 2], y: Y(c + a[i + 3]) },
                    { x: b + a[i + 4], y: Y(c + a[i + 5]) },
                ];
                out.push({ type: "cubic", points: p });
                lastCubicX = b + a[i + 2];
                lastCubicY = c + a[i + 3];
                cx = b + a[i + 4];
                cy = c + a[i + 5];
            }
        } else if (cmd === "S" || cmd === "s") {
            // Smooth cubic: the first control is the reflection of the previous cubic's second control
            // about the current point (or the current point itself if the previous command wasn't a cubic).
            for (let i = 0; i + 3 < a.length; i += 4) {
                const b = rel ? cx : 0;
                const c = rel ? cy : 0;
                const reflect = prevCmd === "C" || prevCmd === "S";
                const c1x = reflect ? 2 * cx - lastCubicX : cx;
                const c1y = reflect ? 2 * cy - lastCubicY : cy;
                const c2x = b + a[i];
                const c2y = c + a[i + 1];
                const ex = b + a[i + 2];
                const ey = c + a[i + 3];
                out.push({
                    type: "cubic",
                    points: [
                        { x: cx, y: Y(cy) },
                        { x: c1x, y: Y(c1y) },
                        { x: c2x, y: Y(c2y) },
                        { x: ex, y: Y(ey) },
                    ],
                });
                lastCubicX = c2x;
                lastCubicY = c2y;
                cx = ex;
                cy = ey;
                prevCmd = "S";
            }
        } else if (cmd === "Q" || cmd === "q") {
            // Promote the quadratic (ctrl q, end e) to a cubic: c1 = p0 + 2/3(q−p0), c2 = e + 2/3(q−e).
            for (let i = 0; i + 3 < a.length; i += 4) {
                const b = rel ? cx : 0;
                const c = rel ? cy : 0;
                const qx = b + a[i];
                const qy = c + a[i + 1];
                const ex = b + a[i + 2];
                const ey = c + a[i + 3];
                out.push({
                    type: "cubic",
                    points: [
                        { x: cx, y: Y(cy) },
                        { x: cx + (2 / 3) * (qx - cx), y: Y(cy + (2 / 3) * (qy - cy)) },
                        { x: ex + (2 / 3) * (qx - ex), y: Y(ey + (2 / 3) * (qy - ey)) },
                        { x: ex, y: Y(ey) },
                    ],
                });
                lastQuadX = qx;
                lastQuadY = qy;
                cx = ex;
                cy = ey;
            }
        } else if (cmd === "T" || cmd === "t") {
            // Smooth quadratic: the control is the reflection of the previous quadratic's control about
            // the current point (or the current point if the previous command wasn't a quadratic).
            for (let i = 0; i + 1 < a.length; i += 2) {
                const b = rel ? cx : 0;
                const c = rel ? cy : 0;
                const reflect = prevCmd === "Q" || prevCmd === "T";
                const qx = reflect ? 2 * cx - lastQuadX : cx;
                const qy = reflect ? 2 * cy - lastQuadY : cy;
                const ex = b + a[i];
                const ey = c + a[i + 1];
                out.push({
                    type: "cubic",
                    points: [
                        { x: cx, y: Y(cy) },
                        { x: cx + (2 / 3) * (qx - cx), y: Y(cy + (2 / 3) * (qy - cy)) },
                        { x: ex + (2 / 3) * (qx - ex), y: Y(ey + (2 / 3) * (qy - ey)) },
                        { x: ex, y: Y(ey) },
                    ],
                });
                lastQuadX = qx;
                lastQuadY = qy;
                cx = ex;
                cy = ey;
                prevCmd = "T";
            }
        } else if (cmd === "A" || cmd === "a") {
            // rx ry x-axis-rotation large-arc-flag sweep-flag x y, repeatable.
            for (let i = 0; i + 6 < a.length; i += 7) {
                const ex = (rel ? cx : 0) + a[i + 5];
                const ey = (rel ? cy : 0) + a[i + 6];
                for (const bz of arcToBeziers(
                    cx,
                    cy,
                    a[i],
                    a[i + 1],
                    (a[i + 2] * Math.PI) / 180,
                    a[i + 3] !== 0,
                    a[i + 4] !== 0,
                    ex,
                    ey,
                )) {
                    out.push({ type: "cubic", points: bz.map((p) => ({ x: p.x, y: Y(p.y) })) });
                }
                cx = ex;
                cy = ey;
            }
        } else if (cmd === "Z" || cmd === "z") {
            line(sx, sy);
            cx = sx;
            cy = sy;
        }
        prevCmd = cmd.toUpperCase();
    }
}

/** Import an SVG file's 2D geometry (in the XY plane) as a compound of edges in an EditableShapeNode. */
export function importSvg(document: IDocument, name: string, text: string): Result<INode> {
    const edges: IEdge[] = [];
    const z = 0;
    for (const e of parseSvg(text)) {
        if (e.type === "line") {
            const r = shapeFactory.line({ x: e.x1, y: e.y1, z }, { x: e.x2, y: e.y2, z });
            if (r.isOk) edges.push(r.value);
        } else if (e.type === "circle") {
            const r = shapeFactory.circle({ x: 0, y: 0, z: 1 }, { x: e.cx, y: e.cy, z }, e.r);
            if (r.isOk) edges.push(r.value);
        } else if (e.type === "ellipse") {
            const major = Math.max(e.rx, e.ry);
            const minor = Math.min(e.rx, e.ry);
            const xvec = e.rx >= e.ry ? { x: 1, y: 0, z } : { x: 0, y: 1, z };
            const r = shapeFactory.ellipse({ x: 0, y: 0, z: 1 }, { x: e.cx, y: e.cy, z }, xvec, major, minor);
            if (r.isOk) edges.push(r.value);
        } else if (e.type === "cubic") {
            const r = shapeFactory.bezier(e.points.map((p) => ({ x: p.x, y: p.y, z })));
            if (r.isOk) edges.push(r.value);
        }
    }
    if (edges.length === 0) {
        return Result.err("SVG contains no supported geometry");
    }
    const compound = shapeFactory.combine(edges);
    if (!compound.isOk) return Result.err(compound.error);
    return Result.ok(new EditableShapeNode({ document, name, shape: compound.value }));
}
