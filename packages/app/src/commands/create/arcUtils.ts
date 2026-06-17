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

function positiveAngle(from: XYZ, to: XYZ, normal: XYZ): number {
    const dot = from.dot(to);
    const crossVec = from.cross(to);
    const crossVal = normal.dot(crossVec);
    let angle = Math.atan2(crossVal, dot);
    if (angle < 0) angle += 2 * Math.PI;
    return angle;
}
