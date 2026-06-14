// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { EditableShapeNode, type INode, JointNode, LinkNode, Plane, XYZ } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { exportUrdf } from "../src/urdf/urdfExporter";
import { importUrdf } from "../src/urdf/urdfImporter";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

function hasGeometry(node: INode): boolean {
    let n = (node as any).firstChild as INode | undefined;
    while (n) {
        if ((n as any).mesh?.faces?.position?.length > 0) return true;
        if (hasGeometry(n)) return true;
        n = n.nextSibling;
    }
    return false;
}
function firstChildOfType<T>(node: INode, ctor: new (...a: any[]) => T): T | undefined {
    let n = (node as any).firstChild as INode | undefined;
    while (n) {
        if (n instanceof ctor) return n as unknown as T;
        n = n.nextSibling;
    }
    return undefined;
}

describe("importUrdf (round-trip)", () => {
    test("export then import rebuilds the Link/Joint tree with mm + degrees", async () => {
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

        const doc2 = new TestDocument() as any;
        const base2 = importUrdf(urdf, meshes, doc2, factory.converter);

        expect(base2).toBeInstanceOf(LinkNode);
        expect(base2!.name).toBe("base_link");
        expect(hasGeometry(base2!)).toBe(true);

        const j = firstChildOfType(base2!, JointNode);
        expect(j).toBeDefined();
        expect(j!.jointType).toBe("revolute");
        expect(j!.axis.z).toBeCloseTo(1, 6);
        expect(j!.lowerLimit).toBeCloseTo(-90, 1); // rad -> deg
        expect(j!.upperLimit).toBeCloseTo(90, 1);
        expect(j!.pivot.x).toBeCloseTo(100, 1); // m -> mm

        const c = firstChildOfType(j!, LinkNode);
        expect(c).toBeDefined();
        expect(c!.name).toBe("child_link");
        expect(hasGeometry(c!)).toBe(true);
    });

    test("the joint pivot point round-trips through URDF (mm)", () => {
        const doc = new TestDocument() as any;
        // No geometry, so the converter is never invoked — a stub keeps this kernel-free.
        const stub = {
            convertToSTL: () => {
                throw new Error("convertToSTL should not be called for geometry-less links");
            },
        } as any;

        const base = new LinkNode({ document: doc, name: "base_link" });
        const child = new LinkNode({ document: doc, name: "child_link" });
        const joint = new JointNode({
            document: doc,
            name: "j1",
            jointType: "revolute",
            pivot: new XYZ({ x: 100, y: 20, z: 5 }),
        });
        joint.add(child);
        base.add(joint);

        const { urdf, meshes } = exportUrdf(base, "robot", stub);
        const base2 = importUrdf(urdf, meshes, new TestDocument() as any, stub);

        const j = firstChildOfType(base2!, JointNode)!;
        expect(j.pivot.x).toBeCloseTo(100, 3);
        expect(j.pivot.y).toBeCloseTo(20, 3);
        expect(j.pivot.z).toBeCloseTo(5, 3);
    });

    test("dynamics, effort/velocity and mimic round-trip through URDF", () => {
        const doc = new TestDocument() as any;
        const stub = {
            convertToSTL: () => {
                throw new Error("convertToSTL should not be called for geometry-less links");
            },
        } as any;

        const base = new LinkNode({ document: doc, name: "base_link" });
        const link1 = new LinkNode({ document: doc, name: "link1" });
        const link2 = new LinkNode({ document: doc, name: "link2" });
        const j1 = new JointNode({ document: doc, name: "j1", jointType: "revolute" });
        j1.damping = 0.5;
        j1.friction = 0.2;
        j1.maxEffort = 33;
        j1.maxVelocity = 7;
        j1.add(link1);
        base.add(j1);
        const j2 = new JointNode({ document: doc, name: "j2", jointType: "revolute" });
        j2.mimicMultiplier = 2;
        j2.add(link2);
        link1.add(j2);
        // Mount the tree so export can resolve the mimic master (looked up by id) by name.
        doc.modelManager.rootNode.add(base);
        j2.mimicJoint = j1.id;

        const { urdf, meshes } = exportUrdf(base, "robot", stub);
        expect(urdf).toContain("<dynamics");
        expect(urdf).toContain("<mimic");

        const doc2 = new TestDocument() as any;
        const base2 = importUrdf(urdf, meshes, doc2, stub)!;
        doc2.modelManager.rootNode.add(base2);
        doc2.modelManager.reinitializeSubtree(base2); // mount → re-wire the mimic

        const j1b = firstChildOfType(base2, JointNode)!;
        expect(j1b.damping).toBeCloseTo(0.5, 4);
        expect(j1b.friction).toBeCloseTo(0.2, 4);
        expect(j1b.maxEffort).toBeCloseTo(33, 4);
        expect(j1b.maxVelocity).toBeCloseTo(7, 4);

        const link1b = firstChildOfType(j1b, LinkNode)!;
        const j2b = firstChildOfType(link1b, JointNode)!;
        expect(j2b.mimicMultiplier).toBeCloseTo(2, 4);
        j1b.value = 10; // mimic re-wired on import: slave follows master (10 × 2)
        expect(j2b.value).toBeCloseTo(20, 4);
    });

    test("parses a hand-written minimal URDF (fixed joint, no meshes)", () => {
        const doc = new TestDocument() as any;
        const stub = {
            convertFromSTL: () => {
                throw new Error("convertFromSTL should not be called when no mesh is present");
            },
        } as any;
        const urdf = `<?xml version="1.0"?>
<robot name="mini">
  <link name="base_link"/>
  <link name="tool"/>
  <joint name="weld" type="fixed">
    <parent link="base_link"/>
    <child link="tool"/>
    <origin xyz="0.05 0 0.1" rpy="0 0 0"/>
  </joint>
</robot>`;
        const base = importUrdf(urdf, new Map(), doc, stub);
        expect(base).toBeInstanceOf(LinkNode);
        expect(base!.name).toBe("base_link");

        const j = firstChildOfType(base!, JointNode)!;
        expect(j.jointType).toBe("fixed");
        expect(j.pivot.x).toBeCloseTo(50, 3); // 0.05 m -> 50 mm
        expect(j.pivot.z).toBeCloseTo(100, 3);

        const tool = firstChildOfType(j, LinkNode)!;
        expect(tool.name).toBe("tool");
        expect(hasGeometry(tool)).toBe(false);
    });
});
