// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { XYZ } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { alignTransform } from "../src/commands/modify/align";

// alignTransform must (a) bring the source face point onto the target point, and (b) rotate the source
// outward normal to oppose the target normal.
describe("alignTransform (face-to-face mate)", () => {
    const close = (a: XYZ, x: number, y: number, z: number) => {
        expect(a.x).toBeCloseTo(x, 6);
        expect(a.y).toBeCloseTo(y, 6);
        expect(a.z).toBeCloseTo(z, 6);
    };

    test("anti-parallel faces (both +Z) flip and translate", () => {
        const m = alignTransform(XYZ.zero, XYZ.unitZ, new XYZ({ x: 5, y: 5, z: 0 }), XYZ.unitZ);
        close(m.ofPoint(XYZ.zero), 5, 5, 0); // source point lands on the target point
        close(m.ofVector(XYZ.unitZ), 0, 0, -1); // source normal now opposes target +Z
    });

    test("already-opposed faces only translate", () => {
        // source +Z, target −Z ⇒ normals already oppose; no rotation, pure slide.
        const m = alignTransform(
            XYZ.zero,
            XYZ.unitZ,
            new XYZ({ x: 0, y: 0, z: 10 }),
            new XYZ({ x: 0, y: 0, z: -1 }),
        );
        close(m.ofPoint(XYZ.zero), 0, 0, 10);
        close(m.ofVector(XYZ.unitZ), 0, 0, 1); // unchanged (still +Z, which opposes target −Z)
    });

    test("perpendicular faces rotate 90° so the normal opposes the target", () => {
        const m = alignTransform(XYZ.zero, XYZ.unitZ, XYZ.zero, XYZ.unitX);
        // target normal +X ⇒ source normal must become −X.
        close(m.ofVector(XYZ.unitZ), -1, 0, 0);
        close(m.ofPoint(XYZ.zero), 0, 0, 0);
    });
});
