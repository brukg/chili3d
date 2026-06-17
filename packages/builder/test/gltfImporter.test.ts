// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { parseGlb } from "../src/gltf/gltfImporter";

// Build a minimal valid GLB containing one triangle: 3 FLOAT VEC3 positions + 3 USHORT indices.
function buildGlb(): Uint8Array {
    const binLen = 44; // 36 (positions) + 6 (indices) padded to 4
    const bin = new ArrayBuffer(binLen);
    const bdv = new DataView(bin);
    [0, 0, 0, 2, 0, 0, 2, 3, 0].forEach((v, i) => bdv.setFloat32(i * 4, v, true));
    bdv.setUint16(36, 0, true);
    bdv.setUint16(38, 1, true);
    bdv.setUint16(40, 2, true);

    const json = JSON.stringify({
        asset: { version: "2.0" },
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
        accessors: [
            { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
            { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
        ],
        bufferViews: [
            { buffer: 0, byteOffset: 0, byteLength: 36 },
            { buffer: 0, byteOffset: 36, byteLength: 6 },
        ],
        buffers: [{ byteLength: 42 }],
    });
    let jsonBytes = new TextEncoder().encode(json);
    while (jsonBytes.length % 4 !== 0) jsonBytes = new Uint8Array([...jsonBytes, 0x20]);

    const total = 12 + 8 + jsonBytes.length + 8 + binLen;
    const out = new Uint8Array(total);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546c67, true);
    dv.setUint32(4, 2, true);
    dv.setUint32(8, total, true);
    let o = 12;
    dv.setUint32(o, jsonBytes.length, true);
    dv.setUint32(o + 4, 0x4e4f534a, true);
    out.set(jsonBytes, o + 8);
    o += 8 + jsonBytes.length;
    dv.setUint32(o, binLen, true);
    dv.setUint32(o + 4, 0x004e4942, true);
    out.set(new Uint8Array(bin), o + 8);
    return out;
}

describe("GLB importer", () => {
    test("parses a minimal GLB triangle (positions from POSITION, indices)", () => {
        const { position, index } = parseGlb(buildGlb());
        expect(Array.from(position)).toEqual([0, 0, 0, 2, 0, 0, 2, 3, 0]);
        expect(Array.from(index)).toEqual([0, 1, 2]);
    });

    test("a non-GLB buffer returns no mesh", () => {
        const { position } = parseGlb(new Uint8Array([1, 2, 3, 4]));
        expect(position.length).toBe(0);
    });
});
