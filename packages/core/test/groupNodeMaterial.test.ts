// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { GeometryNode } from "../src/model/geometryNode";
import { GroupNode } from "../src/model/groupNode";
import { TestDocument } from "./testDocument";

// Minimal concrete geometry node for testing the cascade (createMesh is never called here).
class FakeGeometry extends GeometryNode {
    override display(): any {
        return "common.material";
    }
    protected createMesh(): any {
        return {};
    }
}

describe("GroupNode appearance cascade", () => {
    const doc = new TestDocument() as any;

    test("setting a group's materialId bakes it onto every descendant part, nested included", () => {
        const group = new GroupNode({ document: doc, name: "g" });
        const inner = new GroupNode({ document: doc, name: "inner" });
        const a = new FakeGeometry({ document: doc, name: "a" });
        const b = new FakeGeometry({ document: doc, name: "b" });
        group.add(inner);
        inner.add(a); // nested under a child group
        group.add(b);

        group.materialId = "mat-1";

        expect(group.materialId).toBe("mat-1"); // stored on the group for display
        expect(a.materialId).toBe("mat-1"); // cascaded through the nested group
        expect(b.materialId).toBe("mat-1");
    });

    test("a fresh group has an empty appearance", () => {
        expect(new GroupNode({ document: doc, name: "g" }).materialId).toBe("");
    });

    test("cascading an array appearance gives each part a single id, not a shared array", () => {
        const group = new GroupNode({ document: doc, name: "g" });
        const a = new FakeGeometry({ document: doc, name: "a" });
        const b = new FakeGeometry({ document: doc, name: "b" });
        group.add(a);
        group.add(b);

        group.materialId = ["mat-1", "mat-2"];

        expect(a.materialId).toBe("mat-1"); // stripped to the base id (a string)
        expect(b.materialId).toBe("mat-1");
        expect(Array.isArray(a.materialId)).toBe(false); // not the shared array reference
    });
});
