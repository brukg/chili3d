// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, type INode, Result } from "@chili3d/core";
import { buildSurfaceMeshNode } from "../mesh/buildMesh";

interface ParsedMesh {
    position: Float32Array;
    index: Uint32Array;
}

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'

const COMPONENT_SIZE: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COUNT: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function componentReader(dv: DataView, componentType: number): (o: number) => number {
    switch (componentType) {
        case 5120:
            return (o) => dv.getInt8(o);
        case 5121:
            return (o) => dv.getUint8(o);
        case 5122:
            return (o) => dv.getInt16(o, true);
        case 5123:
            return (o) => dv.getUint16(o, true);
        case 5125:
            return (o) => dv.getUint32(o, true);
        default:
            return (o) => dv.getFloat32(o, true); // 5126
    }
}

// Walk every mesh primitive's POSITION + index accessors (tightly-packed bufferViews) out of the given
// buffers into one flat triangle mesh. Shared by the binary (.glb) and text (.gltf) parsers.
function extractMesh(json: any, buffers: Uint8Array[]): ParsedMesh {
    const accessors = json.accessors ?? [];
    const views = json.bufferViews ?? [];
    const readAccessor = (idx: number): number[] => {
        const acc = accessors[idx];
        const view = views[acc.bufferView];
        const buf = buffers[view.buffer ?? 0];
        if (!buf) return [];
        const bdv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
        const size = COMPONENT_SIZE[acc.componentType] ?? 4;
        const num = TYPE_COUNT[acc.type] ?? 1;
        const read = componentReader(bdv, acc.componentType);
        const out: number[] = [];
        for (let i = 0; i < acc.count * num; i++) out.push(read(base + i * size));
        return out;
    };

    const positions: number[] = [];
    const indices: number[] = [];
    let vbase = 0;
    for (const mesh of json.meshes ?? []) {
        for (const prim of mesh.primitives ?? []) {
            if (prim.attributes?.POSITION == null) continue;
            const pos = readAccessor(prim.attributes.POSITION);
            const count = pos.length / 3;
            const idx =
                prim.indices != null
                    ? readAccessor(prim.indices)
                    : Array.from({ length: count }, (_, i) => i);
            positions.push(...pos);
            for (const ix of idx) indices.push(ix + vbase);
            vbase += count;
        }
    }
    return { position: Float32Array.from(positions), index: Uint32Array.from(indices) };
}

// Decode a `data:...;base64,…` URI into bytes (embedded glTF buffers); returns empty for other URIs.
function decodeDataUri(uri: string | undefined): Uint8Array {
    const i = uri?.indexOf("base64,") ?? -1;
    if (i < 0) return new Uint8Array();
    const b64 = uri!.slice(i + 7);
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Parse a binary glTF (.glb): read the JSON + BIN chunks, then extract the mesh. Interleaved byteStride
 * and external buffers are not handled.
 */
export function parseGlb(data: Uint8Array): ParsedMesh {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (data.length < 12 || dv.getUint32(0, true) !== GLB_MAGIC) {
        return { position: new Float32Array(), index: new Uint32Array() };
    }

    let json: any;
    let bin: Uint8Array | undefined;
    let off = 12;
    while (off + 8 <= data.length) {
        const len = dv.getUint32(off, true);
        const type = dv.getUint32(off + 4, true);
        const chunk = data.subarray(off + 8, off + 8 + len);
        if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(chunk));
        else if (type === CHUNK_BIN) bin = chunk;
        off += 8 + len;
    }
    if (!json || !bin) return { position: new Float32Array(), index: new Uint32Array() };
    return extractMesh(json, [bin]);
}

/** Parse a text glTF (.gltf) with embedded base64 (data-URI) buffers. */
export function parseGltf(text: string): ParsedMesh {
    let json: any;
    try {
        json = JSON.parse(text);
    } catch {
        return { position: new Float32Array(), index: new Uint32Array() };
    }
    const buffers = (json.buffers ?? []).map((b: any) => decodeDataUri(b.uri));
    return extractMesh(json, buffers);
}

/** Import a binary glTF (.glb) file as a {@link MeshNode}. */
export function importGlb(document: IDocument, name: string, data: Uint8Array): Result<INode> {
    const { position, index } = parseGlb(data);
    if (position.length === 0) {
        return Result.err("GLB contains no mesh data");
    }
    return buildSurfaceMeshNode(document, name, position, index);
}

/** Import a text glTF (.gltf) file (with embedded buffers) as a {@link MeshNode}. */
export function importGltf(document: IDocument, name: string, text: string): Result<INode> {
    const { position, index } = parseGltf(text);
    if (position.length === 0) {
        return Result.err("glTF contains no embedded mesh data");
    }
    return buildSurfaceMeshNode(document, name, position, index);
}
