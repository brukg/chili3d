// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, JointNode, Matrix4, XYZ } from "../src";
import { TestDocument } from "./testDocument";

describe("JointNode", () => {
    const doc: IDocument = new TestDocument() as any;

    test("revolute rotates the frame about the axis (value in degrees)", () => {
        const joint = new JointNode({ document: doc, name: "j" });
        joint.jointType = "revolute";
        joint.axis = XYZ.unitZ;
        joint.lowerLimit = -180;
        joint.upperLimit = 180;
        joint.value = 90;
        const p = joint.transform.ofPoint(new XYZ({ x: 10, y: 0, z: 0 }));
        expect(p.distanceTo(new XYZ({ x: 0, y: 10, z: 0 }))).toBeLessThan(1e-6);
    });

    test("prismatic translates along the axis (value in mm)", () => {
        const joint = new JointNode({ document: doc, name: "j", jointType: "prismatic", axis: XYZ.unitX });
        joint.lowerLimit = -100;
        joint.upperLimit = 100;
        joint.value = 10;
        const p = joint.transform.ofPoint(XYZ.zero);
        expect(p.distanceTo(new XYZ({ x: 10, y: 0, z: 0 }))).toBeLessThan(1e-6);
    });

    test("fixed ignores value (transform stays at origin)", () => {
        const joint = new JointNode({ document: doc, name: "j", jointType: "fixed" });
        joint.value = 45;
        expect(joint.transform.equals(Matrix4.identity())).toBe(true);
    });

    test("value clamps to limits for non-continuous joints", () => {
        const joint = new JointNode({ document: doc, name: "j", jointType: "revolute" });
        joint.lowerLimit = -30;
        joint.upperLimit = 30;
        joint.value = 90;
        expect(joint.value).toBe(30);
    });

    test("continuous joint does not clamp", () => {
        const joint = new JointNode({ document: doc, name: "j", jointType: "continuous" });
        joint.lowerLimit = -30;
        joint.upperLimit = 30;
        joint.value = 720;
        expect(joint.value).toBe(720);
    });

    test("revolute rotates about the pivot point, not the world origin", () => {
        // The pivot (10,0,0) is the rotation centre: a point AT the pivot stays fixed, and a point
        // offset from it swings around it (the buggy model would swing about (0,0,0)).
        const joint = new JointNode({
            document: doc,
            name: "j",
            jointType: "revolute",
            pivot: new XYZ({ x: 10, y: 0, z: 0 }),
        });
        joint.lowerLimit = -180;
        joint.upperLimit = 180;
        joint.value = 90;
        // the pivot point is on the axis → unmoved
        const onAxis = joint.transform.ofPoint(new XYZ({ x: 10, y: 0, z: 0 }));
        expect(onAxis.distanceTo(new XYZ({ x: 10, y: 0, z: 0 }))).toBeLessThan(1e-6);
        // (20,0,0) is 10mm along +X from the pivot → 90° about +Z → (10,10,0)
        const offset = joint.transform.ofPoint(new XYZ({ x: 20, y: 0, z: 0 }));
        expect(offset.distanceTo(new XYZ({ x: 10, y: 10, z: 0 }))).toBeLessThan(1e-6);
    });

    test("setting the pivot does NOT move the part (identity at value 0)", () => {
        // This is the core guarantee: the rotation point only sets WHERE rotation happens; changing
        // it never translates the part. At value 0 the transform stays identity for any pivot.
        const joint = new JointNode({ document: doc, name: "j", jointType: "revolute" });
        expect(joint.transform.equals(Matrix4.identity())).toBe(true);
        joint.pivot = new XYZ({ x: 50, y: 60, z: 70 });
        expect(joint.transform.equals(Matrix4.identity())).toBe(true);
        const p = joint.transform.ofPoint(new XYZ({ x: 1, y: 2, z: 3 }));
        expect(p.distanceTo(new XYZ({ x: 1, y: 2, z: 3 }))).toBeLessThan(1e-6);
    });
});
