// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, type INode, Result } from "@chili3d/core";
import { buildSurfaceMeshNode } from "../mesh/buildMesh";

function attr(tag: string, name: string): number {
    const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(tag);
    return m ? Number(m[1]) : Number.NaN;
}

// A 3MF build item's transform is 12 numbers (a 4×3 row-major affine, the last row being the
// translation); points are row vectors [x y z 1]·M. Returns the matrix of the first build item, if any.
export function parseItemTransform(xml: string): number[] | undefined {
    const m = /<item\b[^>]*\btransform\s*=\s*"([^"]*)"/.exec(xml);
    if (!m) return undefined;
    const t = m[1].trim().split(/\s+/).map(Number);
    return t.length === 12 && t.every((n) => !Number.isNaN(n)) ? t : undefined;
}

function applyItemTransform(verts: number[], t: number[]): void {
    for (let i = 0; i < verts.length; i += 3) {
        const x = verts[i];
        const y = verts[i + 1];
        const z = verts[i + 2];
        verts[i] = x * t[0] + y * t[3] + z * t[6] + t[9];
        verts[i + 1] = x * t[1] + y * t[4] + z * t[7] + t[10];
        verts[i + 2] = x * t[2] + y * t[5] + z * t[8] + t[11];
    }
}

/**
 * Parse a 3MF `<model>` XML into a triangle mesh. 3MF stores explicit `<vertex>` (x,y,z) and
 * `<triangle>` (v1,v2,v3) elements, so no triangulation is needed. Attributes are read by name so
 * their order does not matter. A single build-item transform (the common case) is baked into the
 * vertices so the part imports at its intended place rather than the origin.
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
    const transform = parseItemTransform(xml);
    if (transform) applyItemTransform(verts, transform);
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
