// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { EditableShapeNode, type INode, JointNode, LinkNode, Matrix4, Plane } from "@chili3d/core";
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
            origin: Matrix4.fromTranslation(100, 0, 0),
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
        expect(j!.origin.translationPart().x).toBeCloseTo(100, 1); // m -> mm

        const c = firstChildOfType(j!, LinkNode);
        expect(c).toBeDefined();
        expect(c!.name).toBe("child_link");
        expect(hasGeometry(c!)).toBe(true);
    });

    test("a rotated joint origin round-trips (translation mm + rotation rad)", () => {
        const doc = new TestDocument() as any;
        // No geometry, so the converter is never invoked — a stub keeps this kernel-free.
        const stub = {
            convertToSTL: () => {
                throw new Error("convertToSTL should not be called for geometry-less links");
            },
        } as any;

        const base = new LinkNode({ document: doc, name: "base_link" });
        const child = new LinkNode({ document: doc, name: "child_link" });
        // origin = T(100,20,5) · R(fromEuler(0.3,0.2,0.1)) — a generic rotated + translated frame.
        const origin = Matrix4.fromEuler(0.3, 0.2, 0.1).multiply(Matrix4.fromTranslation(100, 20, 5));
        const joint = new JointNode({ document: doc, name: "j1", jointType: "revolute", origin });
        joint.add(child);
        base.add(joint);

        const { urdf, meshes } = exportUrdf(base, "robot", stub);
        const base2 = importUrdf(urdf, meshes, new TestDocument() as any, stub);

        const j = firstChildOfType(base2!, JointNode)!;
        const before = origin.toArray();
        const after = j.origin.toArray();
        for (let i = 0; i < 16; i++) {
            expect(after[i]).toBeCloseTo(before[i], 3);
        }
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
        expect(j.origin.translationPart().x).toBeCloseTo(50, 3); // 0.05 m -> 50 mm
        expect(j.origin.translationPart().z).toBeCloseTo(100, 3);

        const tool = firstChildOfType(j, LinkNode)!;
        expect(tool.name).toBe("tool");
        expect(hasGeometry(tool)).toBe(false);
    });
});
