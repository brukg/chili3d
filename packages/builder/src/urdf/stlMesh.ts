// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { convexHull, type Vec3 } from "./convexHull";

// Binary STL layout: 80-byte header, uint32 triangle count, then 50 bytes per triangle
// (3 floats normal + 9 floats vertices + 2 attribute bytes). All little-endian.
const HEADER = 80;
const TRI_STRIDE = 50;

/** Extract every triangle vertex from a binary STL blob (deduplication happens in the hull). */
export function verticesFromBinarySTL(bytes: Uint8Array): Vec3[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.byteLength < HEADER + 4) return [];
    const count = view.getUint32(HEADER, true);
    const points: Vec3[] = [];
    for (let t = 0; t < count; t++) {
        const base = HEADER + 4 + t * TRI_STRIDE + 12; // skip the 3-float normal
        if (base + 36 > bytes.byteLength) break;
        for (let v = 0; v < 3; v++) {
            const o = base + v * 12;
            points.push([
                view.getFloat32(o, true),
                view.getFloat32(o + 4, true),
                view.getFloat32(o + 8, true),
            ]);
        }
    }
    return points;
}

/** Encode hull points + faces as a binary STL blob (per-face normals recomputed). */
export function hullToBinarySTL(points: Vec3[], faces: [number, number, number][]): Uint8Array {
    const buffer = new ArrayBuffer(HEADER + 4 + faces.length * TRI_STRIDE);
    const view = new DataView(buffer);
    view.setUint32(HEADER, faces.length, true);
    let offset = HEADER + 4;
    for (const [ia, ib, ic] of faces) {
        const a = points[ia];
        const b = points[ib];
        const c = points[ic];
        const ux = b[0] - a[0];
        const uy = b[1] - a[1];
        const uz = b[2] - a[2];
        const vx = c[0] - a[0];
        const vy = c[1] - a[1];
        const vz = c[2] - a[2];
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l;
        ny /= l;
        nz /= l;
        view.setFloat32(offset, nx, true);
        view.setFloat32(offset + 4, ny, true);
        view.setFloat32(offset + 8, nz, true);
        const verts = [a, b, c];
        for (let i = 0; i < 3; i++) {
            const o = offset + 12 + i * 12;
            view.setFloat32(o, verts[i][0], true);
            view.setFloat32(o + 4, verts[i][1], true);
            view.setFloat32(o + 8, verts[i][2], true);
        }
        offset += TRI_STRIDE;
    }
    return new Uint8Array(buffer);
}

/** Build a binary-STL convex hull from a visual binary STL, or undefined if it degenerates. */
export function convexHullSTL(visualStl: Uint8Array): Uint8Array | undefined {
    const hull = convexHull(verticesFromBinarySTL(visualStl));
    if (!hull) return undefined;
    return hullToBinarySTL(hull.points, hull.faces);
}
