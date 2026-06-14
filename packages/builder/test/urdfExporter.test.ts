// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { EditableShapeNode, JointNode, LinkNode, Matrix4, Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { exportUrdf } from "../src/urdf/urdfExporter";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("exportUrdf", () => {
    test("exports base→revolute→child as URDF with correct types, frames, and meshes", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const doc = new TestDocument() as any;

        const base = new LinkNode({ document: doc, name: "base_link" });
        base.add(
            new EditableShapeNode({ document: doc, name: "g", shape: factory.box(Plane.XY, 20, 20, 20) }),
        );

        const child = new LinkNode({ document: doc, name: "child_link" });
        child.add(
            new EditableShapeNode({ document: doc, name: "g", shape: factory.box(Plane.XY, 10, 10, 10) }),
        );

        const joint = new JointNode({
            document: doc,
            name: "j1",
            jointType: "revolute",
            origin: Matrix4.fromTranslation(100, 0, 0),
        });
        joint.lowerLimit = -90;
        joint.upperLimit = 90;
        joint.add(child);
        base.add(joint);

        const { urdf, meshes } = exportUrdf(base, "robot", factory.converter);

        expect(urdf).toContain('<robot name="robot">');
        expect(urdf).toContain('<link name="base_link">');
        expect(urdf).toContain('<link name="child_link">');
        expect(urdf).toContain('type="revolute"');
        expect(urdf).toContain('<parent link="base_link"/>');
        expect(urdf).toContain('<child link="child_link"/>');
        expect(urdf).toContain('xyz="0.1 0 0"');
        expect(urdf).toContain('<axis xyz="0 0 1"/>');
        expect(urdf).toMatch(/lower="-1\.5708\d*"/);
        expect(urdf).toContain('scale="0.001 0.001 0.001"');
        expect(meshes.has("base_link.stl")).toBe(true);
        expect(meshes.get("base_link.stl")!.length).toBeGreaterThan(0);
        expect(meshes.has("child_link.stl")).toBe(true);
    });
});
