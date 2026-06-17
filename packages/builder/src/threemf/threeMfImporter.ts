// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, type INode, Result } from "@chili3d/core";
import { buildSurfaceMeshNode } from "../mesh/buildMesh";

function attr(tag: string, name: string): number {
    const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(tag);
    return m ? Number(m[1]) : Number.NaN;
}

/**
 * Parse a 3MF `<model>` XML into a triangle mesh. 3MF stores explicit `<vertex>` (x,y,z) and
 * `<triangle>` (v1,v2,v3) elements, so no triangulation is needed. Attributes are read by name so
 * their order does not matter.
 */
export function parseModelXml(xml: string): { position: Float32Array; index: Uint32Array } {
    const verts: number[] = [];
    for (const m of xml.matchAll(/<vertex\b[^>]*>/g)) {
        verts.push(attr(m[0], "x"), attr(m[0], "y"), attr(m[0], "z"));
    }
    const tris: number[] = [];
    for (const m of xml.matchAll(/<triangle\b[^>]*>/g)) {
        tris.push(attr(m[0], "v1"), attr(m[0], "v2"), attr(m[0], "v3"));
    }
    return { position: new Float32Array(verts), index: new Uint32Array(tris) };
}

/** Import a 3MF package (a zip whose `*.model` part holds the mesh) as a {@link MeshNode}. */
export async function importThreeMf(
    document: IDocument,
    name: string,
    bytes: Uint8Array,
): Promise<Result<INode>> {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(bytes);
    const entry = zip.file(/\.model$/i)[0] ?? zip.file("3D/3dmodel.model");
    if (!entry) {
        return Result.err("3MF package has no model part");
    }
    const { position, index } = parseModelXml(await entry.async("string"));
    return buildSurfaceMeshNode(document, name, position, index);
}
