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
});
