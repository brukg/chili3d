// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IDocument, INode, Result } from "@chili3d/core";
import { buildSurfaceMeshNode } from "../mesh/buildMesh";

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

/** Import an OBJ file's text as a {@link MeshNode}. */
export function importObj(document: IDocument, name: string, text: string): Result<INode> {
    const { position, index } = parseObj(text);
    return buildSurfaceMeshNode(document, name, position, index);
}
