// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { CurveUtils, type IEdge, type IShape, ShapeTypes, type XYZ } from "@chili3d/core";

// Export 2D shape edges (sketches, projected drawing views, sections) to an SVG document — the vector
// counterpart of the DXF export and the round-trip partner of the SVG importer. CAD is y-up, SVG is
// y-down, so every point is flipped about the drawing's top edge.

type Primitive =
    | { kind: "line"; a: XYZ; b: XYZ }
    | { kind: "circle"; c: XYZ; r: number }
    | { kind: "poly"; points: XYZ[] };

function edgesOf(shape: IShape): IEdge[] {
    if (shape.shapeType === ShapeTypes.edge) return [shape as IEdge];
    return shape.findSubShapes(ShapeTypes.edge) as IEdge[];
}

function edgeToPrimitive(edge: IEdge): Primitive {
    const curve = edge.curve;
    const basis = CurveUtils.isTrimmed(curve) ? curve.basisCurve : curve;

    if (CurveUtils.isLine(basis)) {
        return { kind: "line", a: curve.startPoint(), b: curve.endPoint() };
    }
    if (CurveUtils.isCircle(basis) && curve.isClosed()) {
        return { kind: "circle", c: basis.center, r: basis.radius };
    }
    // Arcs, ellipses and splines tessellate into a polyline — robust for any curve type.
    return { kind: "poly", points: curve.uniformAbscissaByCount(33) };
}

function collectPoints(prim: Primitive): XYZ[] {
    if (prim.kind === "line") return [prim.a, prim.b];
    if (prim.kind === "poly") return prim.points;
    // Circle bounds: the axis-aligned extremes.
    const { c, r } = prim;
    return [{ x: c.x - r, y: c.y - r, z: 0 } as XYZ, { x: c.x + r, y: c.y + r, z: 0 } as XYZ];
}

export function exportSvg(shapes: IShape[]): string {
    const primitives = shapes.flatMap((s) => edgesOf(s).map(edgeToPrimitive));
    const points = primitives.flatMap(collectPoints);
    if (points.length === 0) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0"></svg>';
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    const width = Math.max(maxX - minX, 1e-6);
    const height = Math.max(maxY - minY, 1e-6);

    const fx = (x: number) => (x - minX).toFixed(4);
    const fy = (y: number) => (maxY - y).toFixed(4); // flip y for SVG's top-left origin

    const body: string[] = [];
    for (const prim of primitives) {
        if (prim.kind === "line") {
            body.push(
                `<line x1="${fx(prim.a.x)}" y1="${fy(prim.a.y)}" x2="${fx(prim.b.x)}" y2="${fy(prim.b.y)}"/>`,
            );
        } else if (prim.kind === "circle") {
            body.push(`<circle cx="${fx(prim.c.x)}" cy="${fy(prim.c.y)}" r="${prim.r.toFixed(4)}"/>`);
        } else {
            const pts = prim.points.map((p) => `${fx(p.x)},${fy(p.y)}`).join(" ");
            body.push(`<polyline points="${pts}"/>`);
        }
    }

    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(4)} ${height.toFixed(4)}" ` +
        `width="${width.toFixed(4)}mm" height="${height.toFixed(4)}mm">` +
        `<g fill="none" stroke="#000000" stroke-width="${(Math.max(width, height) / 500).toFixed(4)}">` +
        body.join("") +
        `</g></svg>`
    );
}
