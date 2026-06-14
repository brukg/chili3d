// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { EditableShapeNode, GroupNode, JointNode, LinkNode, Plane, XYZ } from "@chili3d/core";
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
            pivot: new XYZ({ x: 100, y: 0, z: 0 }),
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

    test("collects geometry and joints nested inside folders, not just direct children", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const doc = new TestDocument() as any;

        // base_link's mesh lives inside a folder (organizational group), not directly under the link.
        const base = new LinkNode({ document: doc, name: "base_link" });
        const geometryFolder = new GroupNode({ document: doc, name: "geometry" });
        geometryFolder.add(
            new EditableShapeNode({ document: doc, name: "g", shape: factory.box(Plane.XY, 20, 20, 20) }),
        );
        base.add(geometryFolder);

        // The child link (and its mesh) are also nested in folders, and the joint sits inside a folder.
        const child = new LinkNode({ document: doc, name: "child_link" });
        const childGeometry = new GroupNode({ document: doc, name: "geometry" });
        childGeometry.add(
            new EditableShapeNode({ document: doc, name: "g", shape: factory.box(Plane.XY, 10, 10, 10) }),
        );
        child.add(childGeometry);

        const joint = new JointNode({ document: doc, name: "j1", jointType: "revolute" });
        joint.add(child);
        const articulation = new GroupNode({ document: doc, name: "articulation" });
        articulation.add(joint);
        base.add(articulation);

        const { urdf, meshes } = exportUrdf(base, "robot", factory.converter);

        // Both links' meshes are collected despite the folder nesting (the bug emitted empty links).
        expect(meshes.has("base_link.stl")).toBe(true);
        expect(meshes.get("base_link.stl")!.length).toBeGreaterThan(0);
        expect(meshes.has("child_link.stl")).toBe(true);
        expect(meshes.get("child_link.stl")!.length).toBeGreaterThan(0);
        // The folder-nested joint and its child link are still discovered.
        expect(urdf).toContain('type="revolute"');
        expect(urdf).toContain('<child link="child_link"/>');
    });
});
