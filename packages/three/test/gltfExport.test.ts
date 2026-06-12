// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { VisualNode } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";
import { ThreeMeshExporter } from "../src/meshExporter";
import type { ThreeVisualContext } from "../src/threeVisualContext";

// parseNodeToGroup() calls content.getVisual(node) and collects Mesh children,
// so a stub context returning a Three.js Mesh exercises the real export wrapper
// without needing the full WASM-meshed visual pipeline.
function makeExporter() {
    const mesh = new Mesh(new BoxGeometry(10, 10, 10), new MeshStandardMaterial());
    const content = { getVisual: () => mesh } as unknown as ThreeVisualContext;
    return new ThreeMeshExporter(content);
}
const fakeNode = {} as VisualNode;

describe("glTF export", () => {
    test("exports a non-empty binary .glb (ArrayBuffer)", async () => {
        const result = await makeExporter().exportToGltf([fakeNode], true);
        expect(result.isOk).toBe(true);
        expect((result.value as ArrayBuffer).byteLength).toBeGreaterThan(0);
    });

    test("exports a JSON .gltf string containing the glTF asset header", async () => {
        const result = await makeExporter().exportToGltf([fakeNode], false);
        expect(result.isOk).toBe(true);
        expect(typeof result.value).toBe("string");
        expect(result.value as string).toContain("asset");
    });
});
