// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { XYZ } from "@chili3d/core";

/**
 * Compute arc geometry from 3 points on a circle.
 * A: arc start, B: point on arc path, C: arc end.
 * Returns the center, normal, start point, and signed angle (degrees) for ArcNode.
 */
export function computeArcFromPoints(A: XYZ, B: XYZ, C: XYZ) {
    const circle = computeCircleFromPoints(A, B, C);
    if (!circle) return undefined;

    const OA = A.sub(circle.center).normalize()!;
    const OB = B.sub(circle.center).normalize()!;
    const OC = C.sub(circle.center).normalize()!;

    const angleB = positiveAngle(OA, OB, circle.normal);
    const angleC = positiveAngle(OA, OC, circle.normal);

    const arcAngle = angleB <= angleC ? angleC : angleC - 2 * Math.PI;

    return {
        center: circle.center,
        normal: circle.normal,
        start: A,
        D: circle.D,
        angle: (arcAngle * 180) / Math.PI,
    };
}

/**
 * Compute circle geometry from 3 points.
 * A: arc start, B: point on arc path, C: arc end.
 */
export function computeCircleFromPoints(A: XYZ, B: XYZ, C: XYZ) {
    const AB = B.sub(A);
    const AC = C.sub(A);
    const nvec = AB.cross(AC);
    if (nvec.length() < 1e-10) return undefined;

    const normal = nvec.normalize()!;
    const xvec = AB.normalize()!;
    const yvec = normal.cross(xvec).normalize()!;

    const bx = AB.dot(xvec);
    const by = AB.dot(yvec);
    const cx = AC.dot(xvec);
    const cy = AC.dot(yvec);

    const D = 2 * (bx * cy - cx * by);
    if (Math.abs(D) < 1e-10) return undefined;

    const ux = ((bx * bx + by * by) * cy - (cx * cx + cy * cy) * by) / D;
    const uy = ((bx * bx + by * by) * -cx + (cx * cx + cy * cy) * bx) / D;

    const center = A.add(xvec.multiply(ux)).add(yvec.multiply(uy));
    return {
        center,
        D,
        normal,
        xvec,
        yvec,
    };
}

/**
 * Compute the line where two planes intersect. Each plane is given by a point on it and its normal.
 * Returns the line direction (normalized) and a point on the line, or undefined when the planes are
 * parallel. The point is the one closest to the world origin (the standard two-plane solution).
 */
export function intersectTwoPlanes(p1: XYZ, n1: XYZ, p2: XYZ, n2: XYZ) {
    const u = n1.cross(n2);
    const uLen2 = u.dot(u);
    if (uLen2 < 1e-12) return undefined; // planes are parallel

    const c1 = n1.dot(p1);
    const c2 = n2.dot(p2);
    // point = (c1·(n2×u) + c2·(u×n1)) / |u|²  — the point on the intersection line nearest the origin.
    const point = n2.cross(u).multiply(c1).add(u.cross(n1).multiply(c2)).divided(uLen2)!;
    return { point, direction: u.normalize()! };
}

/**
 * Compute a fillet arc that rounds the corner C between the two rays C→A and C→B with radius r.
 * Returns the two tangent points (t1 on C→A, t2 on C→B) and a midpoint on the arc — ready to feed to
 * computeArcFromPoints. Returns undefined when the rays are degenerate or (anti)parallel, or when the
 * radius is too large for the available ray lengths.
 */
export function filletCorner(C: XYZ, A: XYZ, B: XYZ, r: number) {
    const d1 = A.sub(C).normalize();
    const d2 = B.sub(C).normalize();
    if (!d1 || !d2) return undefined;
    const cosPhi = Math.max(-1, Math.min(1, d1.dot(d2)));
    const phi = Math.acos(cosPhi);
    if (phi < 1e-6 || phi > Math.PI - 1e-6) return undefined; // collinear corner
    const tangentDist = r / Math.tan(phi / 2);
    if (tangentDist > C.distanceTo(A) || tangentDist > C.distanceTo(B)) return undefined;

    const t1 = C.add(d1.multiply(tangentDist));
    const t2 = C.add(d2.multiply(tangentDist));
    const bisector = d1.add(d2).normalize()!;
    const center = C.add(bisector.multiply(r / Math.sin(phi / 2)));
    const mid = center.add(C.sub(center).normalize()!.multiply(r)); // arc point nearest the corner
    return { t1, t2, mid, center };
}

/**
 * Compute a straight chamfer that bevels the corner C between the two rays C→A and C→B by setting back
 * `distance` along each ray. Returns the two setback points (the chamfer line runs c1→c2). Returns
 * undefined when a ray is degenerate or the setback exceeds an available ray length.
 */
export function chamferCorner(C: XYZ, A: XYZ, B: XYZ, distance: number) {
    const d1 = A.sub(C).normalize();
    const d2 = B.sub(C).normalize();
    if (!d1 || !d2) return undefined;
    if (distance > C.distanceTo(A) || distance > C.distanceTo(B)) return undefined;
    return { c1: C.add(d1.multiply(distance)), c2: C.add(d2.multiply(distance)) };
}

function positiveAngle(from: XYZ, to: XYZ, normal: XYZ): number {
    const dot = from.dot(to);
    const crossVec = from.cross(to);
    const crossVal = normal.dot(crossVec);
    let angle = Math.atan2(crossVal, dot);
    if (angle < 0) angle += 2 * Math.PI;
    return angle;
}
