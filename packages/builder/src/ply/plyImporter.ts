// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, type INode, Result } from "@chili3d/core";
import { buildSurfaceMeshNode } from "../mesh/buildMesh";

interface ParsedPly {
    position: Float32Array;
    index: Uint32Array;
}

/**
 * Parse an ASCII Wavefront PLY into a flat triangle mesh. Reads the header for the vertex and face
 * counts, then `vertexCount` vertex lines (first three numbers = x,y,z) and `faceCount` face lines
 * (`n i0 i1 …`, fan-triangulated). Binary PLY is not supported.
 */
export function parsePly(text: string): ParsedPly {
    const lines = text.split("\n");
    let vertexCount = 0;
    let faceCount = 0;
    let headerEnd = -1;
    let format = "ascii";

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("format")) {
            format = line.split(/\s+/)[1] ?? "ascii";
        } else if (line.startsWith("element vertex")) {
            vertexCount = Number.parseInt(line.split(/\s+/)[2], 10);
        } else if (line.startsWith("element face")) {
            faceCount = Number.parseInt(line.split(/\s+/)[2], 10);
        } else if (line === "end_header") {
            headerEnd = i;
            break;
        }
    }

    if (headerEnd < 0 || !format.startsWith("ascii")) {
        return { position: new Float32Array(), index: new Uint32Array() };
    }

    const verts: number[] = [];
    let row = headerEnd + 1;
    for (let v = 0; v < vertexCount && row < lines.length; v++, row++) {
        const p = lines[row].trim().split(/\s+/);
        verts.push(Number(p[0]), Number(p[1]), Number(p[2]));
    }

    const indices: number[] = [];
    for (let f = 0; f < faceCount && row < lines.length; f++, row++) {
        const p = lines[row].trim().split(/\s+/).map(Number);
        const n = p[0];
        for (let i = 2; i < n; i++) {
            indices.push(p[1], p[i], p[i + 1]); // fan triangulation
        }
    }

    return { position: new Float32Array(verts), index: new Uint32Array(indices) };
}

/** Import an ASCII PLY file's text as a {@link MeshNode}. */
export function importPly(document: IDocument, name: string, text: string): Result<INode> {
    const { position, index } = parsePly(text);
    if (position.length === 0) {
        return Result.err("Only ASCII PLY meshes are supported");
    }
    return buildSurfaceMeshNode(document, name, position, index);
}
