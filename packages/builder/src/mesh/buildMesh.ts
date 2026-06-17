// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, type INode, Mesh, MeshGroup, MeshNode, Result } from "@chili3d/core";

/** Per-vertex normals, averaged from incident face normals so the imported mesh shades smoothly. */
export function computeVertexNormals(position: Float32Array, index: Uint32Array): Float32Array {
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

/** Build a surface {@link MeshNode} from a triangle soup (flat positions + triangle indices). */
export function buildSurfaceMeshNode(
    document: IDocument,
    name: string,
    position: Float32Array,
    index: Uint32Array,
): Result<INode> {
    if (position.length === 0 || index.length === 0) {
        return Result.err("mesh contains no triangulated geometry");
    }
    const mesh = new Mesh({
        meshType: "surface",
        position,
        index,
        normal: computeVertexNormals(position, index),
        uv: new Float32Array((position.length / 3) * 2),
        groups: [new MeshGroup({ start: 0, count: index.length, materialIndex: 0 })],
    });
    return Result.ok(new MeshNode({ document, mesh, name }));
}
