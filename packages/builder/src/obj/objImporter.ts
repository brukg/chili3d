// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, type INode, Mesh, MeshGroup, MeshNode, Result } from "@chili3d/core";

interface ParsedObj {
    position: Float32Array;
    index: Uint32Array;
}

/**
 * Parse a Wavefront OBJ into a flat triangle mesh. Handles `v` vertices and `f` faces (polygons are
 * fan-triangulated; `v/vt/vn` indices keep only the vertex index; negative indices are relative).
 */
export function parseObj(text: string): ParsedObj {
    const verts: number[] = [];
    const indices: number[] = [];

    for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (line.startsWith("v ")) {
            const p = line.split(/\s+/);
            verts.push(Number(p[1]), Number(p[2]), Number(p[3]));
        } else if (line.startsWith("f ")) {
            const tokens = line.split(/\s+/).slice(1);
            const count = verts.length / 3;
            const corner = tokens.map((t) => {
                const n = Number.parseInt(t.split("/")[0], 10);
                return n > 0 ? n - 1 : count + n; // OBJ is 1-based; negatives are relative
            });
            // Fan triangulation of the (convex) polygon.
            for (let i = 1; i < corner.length - 1; i++) {
                indices.push(corner[0], corner[i], corner[i + 1]);
            }
        }
    }

    return { position: new Float32Array(verts), index: new Uint32Array(indices) };
}

/** Per-vertex normals, averaged from the incident face normals (so the mesh shades smoothly). */
function computeNormals(position: Float32Array, index: Uint32Array): Float32Array {
    const normal = new Float32Array(position.length);
    for (let i = 0; i < index.length; i += 3) {
        const a = index[i] * 3;
        const b = index[i + 1] * 3;
        const c = index[i + 2] * 3;
        const abx = position[b] - position[a];
        const aby = position[b + 1] - position[a + 1];
        const abz = position[b + 2] - position[a + 2];
        const acx = position[c] - position[a];
        const acy = position[c + 1] - position[a + 1];
        const acz = position[c + 2] - position[a + 2];
        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;
        for (const v of [a, b, c]) {
            normal[v] += nx;
            normal[v + 1] += ny;
            normal[v + 2] += nz;
        }
    }
    for (let i = 0; i < normal.length; i += 3) {
        const len = Math.hypot(normal[i], normal[i + 1], normal[i + 2]) || 1;
        normal[i] /= len;
        normal[i + 1] /= len;
        normal[i + 2] /= len;
    }
    return normal;
}

/** Import an OBJ file's text as a {@link MeshNode}. */
export function importObj(document: IDocument, name: string, text: string): Result<INode> {
    const { position, index } = parseObj(text);
    if (position.length === 0 || index.length === 0) {
        return Result.err("OBJ contains no triangulated geometry");
    }
    const mesh = new Mesh({
        meshType: "surface",
        position,
        index,
        normal: computeNormals(position, index),
        uv: new Float32Array((position.length / 3) * 2),
        groups: [new MeshGroup({ start: 0, count: index.length, materialIndex: 0 })],
    });
    return Result.ok(new MeshNode({ document, mesh, name }));
}
