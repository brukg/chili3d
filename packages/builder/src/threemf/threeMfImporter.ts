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

interface ObjectMesh {
    verts: number[];
    tris: number[];
}

/** Parse every `<object>`'s mesh into its own vertex/triangle arrays, keyed by object id. */
function parseObjects(xml: string): Map<string, ObjectMesh> {
    const objects = new Map<string, ObjectMesh>();
    for (const m of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
        const id = /\bid\s*=\s*"([^"]*)"/.exec(m[1])?.[1] ?? "";
        const verts: number[] = [];
        for (const v of m[2].matchAll(/<vertex\b[^>]*>/g)) {
            verts.push(attr(v[0], "x"), attr(v[0], "y"), attr(v[0], "z"));
        }
        const tris: number[] = [];
        for (const t of m[2].matchAll(/<triangle\b[^>]*>/g)) {
            tris.push(attr(t[0], "v1"), attr(t[0], "v2"), attr(t[0], "v3"));
        }
        objects.set(id, { verts, tris });
    }
    return objects;
}

interface BuildItem {
    objectid: string;
    transform?: number[];
}

/** Parse the `<build>` items (object id + optional placement transform). */
function parseBuildItems(xml: string): BuildItem[] {
    const build = /<build\b[^>]*>([\s\S]*?)<\/build>/.exec(xml);
    if (!build) return [];
    const items: BuildItem[] = [];
    for (const m of build[1].matchAll(/<item\b[^>]*>/g)) {
        const objectid = /\bobjectid\s*=\s*"([^"]*)"/.exec(m[0])?.[1];
        if (!objectid) continue;
        const raw = /\btransform\s*=\s*"([^"]*)"/.exec(m[0])?.[1];
        const t = raw?.trim().split(/\s+/).map(Number);
        const transform = t && t.length === 12 && t.every((n) => !Number.isNaN(n)) ? t : undefined;
        items.push({ objectid, transform });
    }
    return items;
}

/**
 * Parse a 3MF `<model>` XML into a single triangle mesh. 3MF stores explicit `<vertex>` (x,y,z) and
 * `<triangle>` (v1,v2,v3) elements per `<object>`, then a `<build>` places objects via items with an
 * optional transform. Each object's triangles are indexed within its own mesh, so they are re-based as
 * the objects are concatenated; build-item transforms are baked in so parts land where intended. When
 * there is no `<build>`, every object is taken at identity.
 */
export function parseModelXml(xml: string): { position: Float32Array; index: Uint32Array } {
    const objects = parseObjects(xml);
    const items = parseBuildItems(xml);
    const placements: BuildItem[] =
        items.length > 0 ? items : [...objects.keys()].map((objectid) => ({ objectid }));

    const position: number[] = [];
    const index: number[] = [];
    for (const item of placements) {
        const object = objects.get(item.objectid);
        if (!object || object.verts.length === 0) continue;
        const base = position.length / 3;
        const verts = object.verts.slice();
        if (item.transform) applyItemTransform(verts, item.transform);
        for (const c of verts) position.push(c);
        for (const i of object.tris) index.push(i + base);
    }
    return { position: new Float32Array(position), index: new Uint32Array(index) };
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
