// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { CurveUtils, type IEdge, type IShape, ShapeTypes, type XYZ } from "@chili3d/core";

// Minimal AutoCAD R12 ASCII DXF export of a model's edges. Lines and full circles are emitted
// exactly; arcs become ARC entities; every other curve (bspline, ellipse, …) is tessellated into
// straight LINE segments so the geometry is always faithful regardless of curve type.

const num = (v: number): string => String(Number(v.toFixed(6)));

function pair(code: number, value: string): string {
    return `${code}\n${value}\n`;
}

function lineEntity(a: XYZ, b: XYZ): string {
    return (
        pair(0, "LINE") +
        pair(8, "0") +
        pair(10, num(a.x)) +
        pair(20, num(a.y)) +
        pair(30, num(a.z)) +
        pair(11, num(b.x)) +
        pair(21, num(b.y)) +
        pair(31, num(b.z))
    );
}

function circleEntity(center: XYZ, radius: number): string {
    return (
        pair(0, "CIRCLE") +
        pair(8, "0") +
        pair(10, num(center.x)) +
        pair(20, num(center.y)) +
        pair(30, num(center.z)) +
        pair(40, num(radius))
    );
}

function arcEntity(center: XYZ, radius: number, startDeg: number, endDeg: number): string {
    return (
        pair(0, "ARC") +
        pair(8, "0") +
        pair(10, num(center.x)) +
        pair(20, num(center.y)) +
        pair(30, num(center.z)) +
        pair(40, num(radius)) +
        pair(50, num(startDeg)) +
        pair(51, num(endDeg))
    );
}

function angleDeg(center: XYZ, point: XYZ): number {
    const a = (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
    return a < 0 ? a + 360 : a;
}

function edgeToDxf(edge: IEdge): string {
    const curve = edge.curve;
    const basis = CurveUtils.isTrimmed(curve) ? curve.basisCurve : curve;

    if (CurveUtils.isLine(basis)) {
        return lineEntity(curve.startPoint(), curve.endPoint());
    }
    if (CurveUtils.isCircle(basis)) {
        if (curve.isClosed()) {
            return circleEntity(basis.center, basis.radius);
        }
        const start = curve.startPoint();
        const end = curve.endPoint();
        return arcEntity(
            basis.center,
            basis.radius,
            angleDeg(basis.center, start),
            angleDeg(basis.center, end),
        );
    }
    // Fallback: tessellate into a chain of straight segments.
    const points = curve.uniformAbscissaByCount(33);
    let out = "";
    for (let i = 0; i + 1 < points.length; i++) {
        out += lineEntity(points[i], points[i + 1]);
    }
    return out;
}

function edgesOf(shape: IShape): IEdge[] {
    if (shape.shapeType === ShapeTypes.edge) return [shape as IEdge];
    return shape.findSubShapes(ShapeTypes.edge) as IEdge[];
}

export function exportDxf(shapes: IShape[]): string {
    let entities = "";
    for (const shape of shapes) {
        for (const edge of edgesOf(shape)) {
            entities += edgeToDxf(edge);
        }
    }
    return pair(0, "SECTION") + pair(2, "ENTITIES") + entities + pair(0, "ENDSEC") + pair(0, "EOF");
}
