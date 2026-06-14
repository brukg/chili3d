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

    test("revolute rotates about the origin's location, not the world origin", () => {
        // origin places the joint frame at (10,0,0); a point AT that frame origin lies on the
        // rotation axis and must stay fixed under rotation. The buggy multiply order made it
        // rotate about (0,0,0) and swing the point to (0,10,0).
        const joint = new JointNode({
            document: doc,
            name: "j",
            jointType: "revolute",
            origin: Matrix4.fromTranslation(10, 0, 0),
        });
        joint.lowerLimit = -180;
        joint.upperLimit = 180;
        joint.value = 90;
        const p = joint.transform.ofPoint(XYZ.zero);
        expect(p.distanceTo(new XYZ({ x: 10, y: 0, z: 0 }))).toBeLessThan(1e-6);
    });

    test("origin composes outside the DOF", () => {
        const joint = new JointNode({
            document: doc,
            name: "j",
            jointType: "prismatic",
            axis: XYZ.unitX,
            origin: Matrix4.fromTranslation(0, 0, 5),
        });
        joint.lowerLimit = -100;
        joint.upperLimit = 100;
        joint.value = 10;
        const p = joint.transform.ofPoint(XYZ.zero);
        expect(p.distanceTo(new XYZ({ x: 10, y: 0, z: 5 }))).toBeLessThan(1e-6);
    });
});
