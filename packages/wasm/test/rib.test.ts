// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IEdge, type IFace, type IShape, type ISolid, type IWire, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

type P = { x: number; y: number; z: number };

describe("Rib feature (headless)", () => {
    // Build the L-shaped prism base from OCCT's own MakeLinearForm example: an L profile in the
    // XZ plane (y=0) extruded 100mm in +Y.
    function lPrism(factory: ShapeFactory): IShape {
        const pts: P[] = [
            { x: 0, y: 0, z: 0 },
            { x: 200, y: 0, z: 0 },
            { x: 200, y: 0, z: 50 },
            { x: 50, y: 0, z: 50 },
            { x: 50, y: 0, z: 200 },
            { x: 0, y: 0, z: 200 },
        ];
        const edges: IEdge[] = [];
        for (let i = 0; i < pts.length; i++) {
            const e = factory.line(pts[i], pts[(i + 1) % pts.length]);
            expect(e.isOk).toBe(true);
            edges.push(e.value as IEdge);
        }
        const wire = factory.wire(edges);
        expect(wire.isOk).toBe(true);
        const face = factory.face([wire.value as IWire]);
        expect(face.isOk).toBe(true);
        const prism = factory.prism(face.value as IFace, new XYZ({ x: 0, y: 100, z: 0 }));
        expect(prism.isOk).toBe(true);
        return prism.value;
    }

    test("builds a rib on the L-prism (OCCT canonical example), adding material", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();

        const base = lPrism(factory);
        const baseVolume = (base as ISolid).volume();

        // Rib silhouette: the single diagonal segment from OCCT's example, in plane y=45.
        const edge = factory.line({ x: 50, y: 45, z: 100 }, { x: 100, y: 45, z: 50 });
        expect(edge.isOk).toBe(true);
        const profile = factory.wire([edge.value as IEdge]);
        expect(profile.isOk).toBe(true);

        // Plane (0,45,0) normal +Y; thicken 5mm one way, 3mm the other (total 8mm rib width).
        const rib = factory.rib(
            base,
            profile.value as IWire,
            { x: 0, y: 45, z: 0 },
            { x: 0, y: 1, z: 0 },
            5,
            3,
            true,
        );
        expect(rib.isOk).toBe(true);

        const after = (rib.value as ISolid).volume();
        expect(after).toBeGreaterThan(baseVolume); // a rib adds material
    });

    test("rejects a non-wire profile", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const base = lPrism(factory);
        const edge = factory.line({ x: 50, y: 45, z: 100 }, { x: 100, y: 45, z: 50 });
        const bad = factory.rib(
            base,
            edge.value as unknown as IWire, // an edge, not a wire
            { x: 0, y: 45, z: 0 },
            { x: 0, y: 1, z: 0 },
            5,
            3,
            true,
        );
        expect(bad.isOk).toBe(false);
    });
});
