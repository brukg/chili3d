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

// Byte size of each PLY scalar type.
const PLY_SIZE: Record<string, number> = {
    char: 1,
    uchar: 1,
    int8: 1,
    uint8: 1,
    short: 2,
    ushort: 2,
    int16: 2,
    uint16: 2,
    int: 4,
    uint: 4,
    int32: 4,
    uint32: 4,
    float: 4,
    float32: 4,
    double: 8,
    float64: 8,
};

// A DataView reader for the given PLY scalar type and endianness.
function plyReader(dv: DataView, type: string, le: boolean): (o: number) => number {
    switch (type) {
        case "char":
        case "int8":
            return (o) => dv.getInt8(o);
        case "uchar":
        case "uint8":
            return (o) => dv.getUint8(o);
        case "short":
        case "int16":
            return (o) => dv.getInt16(o, le);
        case "ushort":
        case "uint16":
            return (o) => dv.getUint16(o, le);
        case "int":
        case "int32":
            return (o) => dv.getInt32(o, le);
        case "uint":
        case "uint32":
            return (o) => dv.getUint32(o, le);
        case "double":
        case "float64":
            return (o) => dv.getFloat64(o, le);
        default:
            return (o) => dv.getFloat32(o, le);
    }
}

const END_HEADER = [101, 110, 100, 95, 104, 101, 97, 100, 101, 114, 10]; // "end_header\n"

/**
 * Parse a binary PLY (little- or big-endian). Reads the ASCII header for the vertex/face element
 * layouts, then walks the binary body: each vertex is a fixed record (x/y/z taken from its declared
 * properties), each face a count byte followed by its indices (fan-triangulated).
 */
export function parsePlyBinary(data: Uint8Array): ParsedPly {
    let bodyStart = -1;
    for (let i = 0; i + END_HEADER.length <= data.length; i++) {
        if (END_HEADER.every((b, k) => data[i + k] === b)) {
            bodyStart = i + END_HEADER.length;
            break;
        }
    }
    if (bodyStart < 0) return { position: new Float32Array(), index: new Uint32Array() };

    const header = new TextDecoder("ascii").decode(data.subarray(0, bodyStart));
    const le = !header.includes("binary_big_endian");
    let vertexCount = 0;
    let faceCount = 0;
    const vertexProps: { name: string; type: string }[] = [];
    let faceCountType = "uchar";
    let faceIndexType = "int";
    let element = "";
    for (const raw of header.split("\n")) {
        const t = raw.trim().split(/\s+/);
        if (t[0] === "element") {
            element = t[1];
            if (element === "vertex") vertexCount = Number.parseInt(t[2], 10);
            else if (element === "face") faceCount = Number.parseInt(t[2], 10);
        } else if (t[0] === "property") {
            if (t[1] === "list") {
                faceCountType = t[2];
                faceIndexType = t[3];
            } else if (element === "vertex") {
                vertexProps.push({ type: t[1], name: t[2] });
            }
        }
    }

    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let stride = 0;
    const offsetOf: Record<string, number> = {};
    for (const p of vertexProps) {
        offsetOf[p.name] = stride;
        stride += PLY_SIZE[p.type] ?? 4;
    }
    const fx = plyReader(dv, vertexProps.find((p) => p.name === "x")?.type ?? "float", le);
    const fy = plyReader(dv, vertexProps.find((p) => p.name === "y")?.type ?? "float", le);
    const fz = plyReader(dv, vertexProps.find((p) => p.name === "z")?.type ?? "float", le);

    const position = new Float32Array(vertexCount * 3);
    for (let v = 0; v < vertexCount; v++) {
        const base = bodyStart + v * stride;
        position[v * 3] = fx(base + offsetOf["x"]);
        position[v * 3 + 1] = fy(base + offsetOf["y"]);
        position[v * 3 + 2] = fz(base + offsetOf["z"]);
    }

    const readCount = plyReader(dv, faceCountType, le);
    const readIndex = plyReader(dv, faceIndexType, le);
    const countSize = PLY_SIZE[faceCountType] ?? 1;
    const indexSize = PLY_SIZE[faceIndexType] ?? 4;
    const indices: number[] = [];
    let off = bodyStart + vertexCount * stride;
    for (let f = 0; f < faceCount && off < data.length; f++) {
        const n = readCount(off);
        off += countSize;
        const verts: number[] = [];
        for (let i = 0; i < n; i++) {
            verts.push(readIndex(off));
            off += indexSize;
        }
        for (let i = 1; i + 1 < n; i++) indices.push(verts[0], verts[i], verts[i + 1]); // fan
    }
    return { position, index: new Uint32Array(indices) };
}

/** Import a PLY file (ASCII or binary) as a {@link MeshNode}. */
export function importPly(document: IDocument, name: string, data: Uint8Array): Result<INode> {
    const header = new TextDecoder("ascii").decode(data.subarray(0, Math.min(data.length, 1024)));
    const isBinary = /format\s+binary/.test(header);
    const { position, index } = isBinary
        ? parsePlyBinary(data)
        : parsePly(new TextDecoder("utf-8").decode(data));
    if (position.length === 0) {
        return Result.err("PLY contains no mesh data");
    }
    return buildSurfaceMeshNode(document, name, position, index);
}
