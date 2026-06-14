// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IShape, type IShapeConverter, Result } from "@chili3d/core";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rel0" Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

export function stlToIndexedMesh(stl: Uint8Array): { vertices: number[]; triangles: number[] } {
    const view = new DataView(stl.buffer, stl.byteOffset, stl.byteLength);
    const count = view.getUint32(80, true);
    const vertices: number[] = [];
    const triangles: number[] = [];
    const index = new Map<string, number>();
    let offset = 84;
    const vertexIndex = (x: number, y: number, z: number): number => {
        const key = `${x},${y},${z}`;
        let i = index.get(key);
        if (i === undefined) {
            i = vertices.length / 3;
            vertices.push(x, y, z);
            index.set(key, i);
        }
        return i;
    };
    for (let t = 0; t < count; t++) {
        offset += 12; // skip normal
        const corner = (): number => {
            const x = view.getFloat32(offset, true);
            const y = view.getFloat32(offset + 4, true);
            const z = view.getFloat32(offset + 8, true);
            offset += 12;
            return vertexIndex(x, y, z);
        };
        const a = corner();
        const b = corner();
        const c = corner();
        offset += 2; // skip attribute byte count
        triangles.push(a, b, c);
    }
    return { vertices, triangles };
}

const fmt = (v: number): string => String(Number(v.toFixed(6)));

export function buildModelXml(mesh: { vertices: number[]; triangles: number[] }): string {
    const verts: string[] = [];
    for (let i = 0; i < mesh.vertices.length; i += 3) {
        verts.push(
            `     <vertex x="${fmt(mesh.vertices[i])}" y="${fmt(mesh.vertices[i + 1])}" z="${fmt(mesh.vertices[i + 2])}"/>`,
        );
    }
    const tris: string[] = [];
    for (let i = 0; i < mesh.triangles.length; i += 3) {
        tris.push(
            `     <triangle v1="${mesh.triangles[i]}" v2="${mesh.triangles[i + 1]}" v3="${mesh.triangles[i + 2]}"/>`,
        );
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources>
  <object id="1" type="model">
   <mesh>
    <vertices>
${verts.join("\n")}
    </vertices>
    <triangles>
${tris.join("\n")}
    </triangles>
   </mesh>
  </object>
 </resources>
 <build>
  <item objectid="1"/>
 </build>
</model>`;
}

export async function exportThreeMf(
    shapes: IShape[],
    converter: IShapeConverter,
): Promise<Result<Uint8Array>> {
    const stl = converter.convertToSTL(shapes, { binary: true });
    if (!stl.isOk) return Result.err(stl.error);
    const mesh = stlToIndexedMesh(stl.value);
    const model = buildModelXml(mesh);

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES);
    zip.file("_rels/.rels", RELS);
    zip.file("3D/3dmodel.model", model);
    const bytes = await zip.generateAsync({ type: "uint8array" });
    return Result.ok(bytes);
}
