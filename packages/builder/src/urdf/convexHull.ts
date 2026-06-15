// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Vector3 } from "three";
import { ConvexHull } from "three/examples/jsm/math/ConvexHull.js";

// A 3D convex hull, used to build a tight-but-cheap collision geometry for URDF export. Robotics
// collision checking wants a convex collider: an axis-aligned box is too loose, the full visual mesh
// is too slow and unstable, and a convex hull of the link's mesh is the standard middle ground. We
// compute it from the link's tessellated vertices (parsed from the visual STL) so no kernel rebuild
// is needed. three's ConvexHull is used because it robustly merges coplanar faces — a hand-rolled
// incremental hull produces degenerate (non-manifold) faces on the many coplanar points a tessellated
// box or cylinder yields.

export type Vec3 = [number, number, number];

export interface ConvexHullResult {
    points: Vec3[];
    faces: [number, number, number][];
}

/**
 * Compute the convex hull of a point cloud. Returns the hull's vertices and triangular faces
 * (fan-triangulated index triples), or `undefined` when the cloud is degenerate (fewer than 4
 * non-coplanar points) — in which case the caller should fall back to a box collider.
 */
export function convexHull(input: Vec3[]): ConvexHullResult | undefined {
    if (input.length < 4) return undefined;

    let hull: ConvexHull;
    try {
        hull = new ConvexHull().setFromPoints(input.map((p) => new Vector3(p[0], p[1], p[2])));
    } catch {
        return undefined; // coplanar / collinear input throws inside three.
    }
    if (!hull.faces || hull.faces.length < 4) return undefined;

    const points: Vec3[] = [];
    const indexOf = new Map<string, number>();
    const idx = (v: Vector3): number => {
        const key = `${Math.round(v.x * 1e5)},${Math.round(v.y * 1e5)},${Math.round(v.z * 1e5)}`;
        let i = indexOf.get(key);
        if (i === undefined) {
            i = points.length;
            indexOf.set(key, i);
            points.push([v.x, v.y, v.z]);
        }
        return i;
    };

    const faces: [number, number, number][] = [];
    for (const face of hull.faces) {
        // Walk the face's half-edge ring to get its (possibly n-gon) vertices, then fan-triangulate.
        const ring: Vector3[] = [];
        let edge = face.edge;
        do {
            ring.push(edge.head().point);
            edge = edge.next;
        } while (edge !== face.edge);
        for (let i = 1; i + 1 < ring.length; i++) {
            faces.push([idx(ring[0]), idx(ring[i]), idx(ring[i + 1])]);
        }
    }

    if (points.length < 4 || faces.length < 4) return undefined;
    // Reject a degenerate (near-flat) hull: collision needs a real volume, not a sheet. Compare the
    // enclosed volume against the bounding extent cubed so the threshold scales with the geometry.
    const extent = boundingExtent(points);
    if (hullVolume(points, faces) < 1e-6 * extent * extent * extent) return undefined;
    return { points, faces };
}

// Enclosed volume of the (outward-oriented, triangulated) hull via the divergence theorem.
function hullVolume(points: Vec3[], faces: [number, number, number][]): number {
    let v = 0;
    for (const [ia, ib, ic] of faces) {
        const a = points[ia];
        const b = points[ib];
        const c = points[ic];
        v +=
            a[0] * (b[1] * c[2] - b[2] * c[1]) +
            a[1] * (b[2] * c[0] - b[0] * c[2]) +
            a[2] * (b[0] * c[1] - b[1] * c[0]);
    }
    return Math.abs(v) / 6;
}

function boundingExtent(points: Vec3[]): number {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (const [x, y, z] of points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
    }
    return Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-9);
}
