// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { MathUtils, Matrix4, XYZ } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { dofToValue, valueToDof } from "../src/jointGizmoMath";

describe("jointGizmoMath", () => {
    test("prismatic: value↔dof round-trips along local Z (mm)", () => {
        const dof = valueToDof("prismatic", 10);
        expect(dof.ofPoint(XYZ.zero).distanceTo(new XYZ({ x: 0, y: 0, z: 10 }))).toBeLessThan(1e-6);
        expect(dofToValue("prismatic", dof)).toBeCloseTo(10, 6);
    });

    test("revolute: value↔dof round-trips as rotation about local Z (degrees)", () => {
        const dof = valueToDof("revolute", 90);
        expect(dof.ofVector(XYZ.unitX).distanceTo(new XYZ({ x: 0, y: 1, z: 0 }))).toBeLessThan(1e-6);
        expect(dofToValue("revolute", dof)).toBeCloseTo(90, 6);
    });

    test("continuous behaves like revolute", () => {
        expect(dofToValue("continuous", valueToDof("continuous", -45))).toBeCloseTo(-45, 6);
    });

    test("fixed maps to identity / zero", () => {
        expect(valueToDof("fixed", 33).equals(Matrix4.identity())).toBe(true);
        expect(dofToValue("fixed", Matrix4.fromTranslation(0, 0, 5))).toBe(0);
    });

    test("revolute reads a directly-built rotation matrix", () => {
        const dof = Matrix4.fromAxisRad(XYZ.zero, XYZ.unitZ, MathUtils.degToRad(30));
        expect(dofToValue("revolute", dof)).toBeCloseTo(30, 6);
    });
});
