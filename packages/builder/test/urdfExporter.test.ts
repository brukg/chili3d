// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
    EditableShapeNode,
    GroupNode,
    JointNode,
    LinkNode,
    Material,
    Matrix4,
    Plane,
    XYZ,
} from "@chili3d/core";
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

    test("a geared joint emits a SimpleTransmission with its mechanical reduction", async () => {
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
        const joint = new JointNode({ document: doc, name: "j1", jointType: "revolute" });
        joint.gearRatio = 50;
        joint.add(child);
        base.add(joint);

        const { urdf } = exportUrdf(base, "robot", factory.converter);
        expect(urdf).toContain('<transmission name="j1_trans">');
        expect(urdf).toContain("<mechanicalReduction>50</mechanicalReduction>");
        expect(urdf).toContain('<actuator name="j1_motor">');
    });

    test("a direct-drive joint (ratio 1) emits no transmission", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const doc = new TestDocument() as any;

        const base = new LinkNode({ document: doc, name: "base_link" });
        base.add(
            new EditableShapeNode({ document: doc, name: "g", shape: factory.box(Plane.XY, 20, 20, 20) }),
        );
        const child = new LinkNode({ document: doc, name: "child_link" });
        const joint = new JointNode({ document: doc, name: "j1", jointType: "revolute" });
        joint.add(child);
        base.add(joint);

        const { urdf } = exportUrdf(base, "robot", factory.converter);
        expect(urdf).not.toContain("<transmission");
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

    test("emits real centre-of-mass and inertia from the solid, not a bounding-box guess", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const doc = new TestDocument() as any;

        // Box (0,0,0)-(10,20,30) mm → COM (5,10,15) mm = (0.005,0.01,0.015) m.
        const base = new LinkNode({ document: doc, name: "base_link" });
        base.mass = 2;
        base.add(
            new EditableShapeNode({ document: doc, name: "g", shape: factory.box(Plane.XY, 10, 20, 30) }),
        );

        const { urdf } = exportUrdf(base, "robot", factory.converter);

        // The inertial origin is the true COM, not the link origin (which an AABB guess would imply).
        expect(urdf).toContain('<inertial><origin xyz="0.005 0.01 0.015"');
        expect(urdf).toContain('<mass value="2"/>');

        // Analytical solid-box inertia about COM (m=2 kg, sides 0.01/0.02/0.03 m):
        //   Ixx = m/12·(dy²+dz²), etc. Off-diagonal terms are zero.
        const get = (axis: string) => {
            const m = urdf.match(new RegExp(`${axis}="([0-9.eE-]+)"`));
            return m ? Number(m[1]) : Number.NaN;
        };
        expect(get("ixx")).toBeCloseTo((2 / 12) * (0.02 ** 2 + 0.03 ** 2), 8);
        expect(get("iyy")).toBeCloseTo((2 / 12) * (0.01 ** 2 + 0.03 ** 2), 8);
        expect(get("izz")).toBeCloseTo((2 / 12) * (0.01 ** 2 + 0.02 ** 2), 8);
        // An axis-aligned box has zero products of inertia.
        expect(urdf).toContain('ixy="0"');
    });

    test("emits real off-diagonal products of inertia for a tilted solid", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const doc = new TestDocument() as any;

        // A 10×20×30 box rotated 45° about Z develops a non-zero Ixy product of inertia.
        const rot = Matrix4.fromAxisRad(XYZ.zero, XYZ.unitZ, Math.PI / 4);
        const base = new LinkNode({ document: doc, name: "base_link" });
        base.mass = 2;
        base.add(
            new EditableShapeNode({
                document: doc,
                name: "g",
                shape: factory.box(Plane.XY, 10, 20, 30).value.transformedMul(rot),
            }),
        );

        const { urdf } = exportUrdf(base, "robot", factory.converter);
        const get = (axis: string) => {
            const m = urdf.match(new RegExp(`${axis}="([0-9.eE-]+)"`));
            return m ? Number(m[1]) : Number.NaN;
        };

        // Ixy = (Ixx0 − Iyy0)·sinθ·cosθ scaled to SI: unit-density mm⁵ × (mass/volume) × mm²→m².
        const k = (2 / 6000) * 1e-6;
        const expectedIxy = ((6000 / 12) * (20 ** 2 + 30 ** 2) - (6000 / 12) * (10 ** 2 + 30 ** 2)) * 0.5 * k;
        expect(get("ixy")).toBeCloseTo(expectedIxy, 7);
        expect(Math.abs(get("ixy"))).toBeGreaterThan(1e-6); // genuinely non-zero
        // Z is the rotation axis → these products remain zero.
        expect(get("ixz")).toBe(0);
        expect(get("iyz")).toBe(0);
    });

    test("collision geometry: convex hull by default, box or exact mesh on request", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const doc = new TestDocument() as any;

        const base = new LinkNode({ document: doc, name: "base_link" });
        base.add(
            new EditableShapeNode({ document: doc, name: "g", shape: factory.box(Plane.XY, 10, 20, 30) }),
        );

        // Default: a convex hull mesh, emitted as a separate collision STL distinct from the visual.
        const convex = exportUrdf(base, "robot", factory.converter);
        expect(convex.urdf).toContain('<collision><geometry><mesh filename="meshes/base_link_collision.stl"');
        expect(convex.meshes.has("base_link_collision.stl")).toBe(true);
        expect(convex.meshes.get("base_link_collision.stl")!.length).toBeGreaterThan(0);
        expect(convex.urdf).not.toContain("<box size=");
        // The visual still uses the full mesh.
        expect(convex.urdf).toContain("<visual><geometry><mesh");

        // Box: a cheap AABB primitive, sized in metres and centred on the AABB.
        base.collisionGeometry = "box";
        const boxed = exportUrdf(base, "robot", factory.converter).urdf;
        expect(boxed).toContain('<collision><origin xyz="0.005 0.01 0.015"');
        expect(boxed).toContain('<box size="0.01 0.02 0.03"/>');

        // Mesh: reuse the exact visual mesh, no separate collision file.
        base.collisionGeometry = "mesh";
        const meshed = exportUrdf(base, "robot", factory.converter);
        expect(meshed.urdf).not.toContain("<box size=");
        expect(meshed.urdf).toMatch(/<collision><geometry><mesh filename="meshes\/base_link.stl"/);
        expect(meshed.meshes.has("base_link_collision.stl")).toBe(false);
    });

    test("exports the link's material colour into <visual>", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const doc = new TestDocument() as any;

        const red = new Material({ document: doc, name: "red", color: 0xff0000, id: "red-id" });
        doc.modelManager.materials.push(red);

        const base = new LinkNode({ document: doc, name: "base_link" });
        const geom = new EditableShapeNode({
            document: doc,
            name: "g",
            shape: factory.box(Plane.XY, 10, 10, 10),
        });
        geom.materialId = "red-id";
        base.add(geom);

        const { urdf } = exportUrdf(base, "robot", factory.converter);
        expect(urdf).toContain('<material name="base_link_material"><color rgba="1 0 0 1"/></material>');
    });
});
