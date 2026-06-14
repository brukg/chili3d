// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Matrix4 } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { matrixToRpy, rpyToMatrix } from "../src/urdf/urdfMath";

const X = { x: 1, y: 0, z: 0 };
const Y = { x: 0, y: 1, z: 0 };
const Z = { x: 0, y: 0, z: 1 };
const ORIGIN = { x: 0, y: 0, z: 0 };

function expectVecClose(actual: { x: number; y: number; z: number }, e: number[]) {
    expect(actual.x).toBeCloseTo(e[0], 6);
    expect(actual.y).toBeCloseTo(e[1], 6);
    expect(actual.z).toBeCloseTo(e[2], 6);
}

describe("urdfMath — fixed-axis roll-pitch-yaw (URDF/REP-103 convention)", () => {
    const HALF_PI = Math.PI / 2;

    test("pure roll rotates about X: Y -> Z", () => {
        expectVecClose(rpyToMatrix(HALF_PI, 0, 0).ofVector(Y), [0, 0, 1]);
    });

    test("pure pitch rotates about Y: Z -> X", () => {
        expectVecClose(rpyToMatrix(0, HALF_PI, 0).ofVector(Z), [1, 0, 0]);
    });

    test("pure yaw rotates about Z: X -> Y", () => {
        expectVecClose(rpyToMatrix(0, 0, HALF_PI).ofVector(X), [0, 1, 0]);
    });

    test("compound rpy equals applying Rx then Ry then Rz to a vector (URDF order)", () => {
        // URDF defines R = Rz(yaw)·Ry(pitch)·Rx(roll), i.e. on a vector: roll first, then pitch,
        // then yaw. Validate by applying chili3d axis rotations to a vector sequentially —
        // convention-independent (no reliance on matrix-multiply ordering).
        const roll = 0.5,
            pitch = 0.3,
            yaw = 0.2;
        const Rx = Matrix4.fromAxisRad(ORIGIN, X, roll);
        const Ry = Matrix4.fromAxisRad(ORIGIN, Y, pitch);
        const Rz = Matrix4.fromAxisRad(ORIGIN, Z, yaw);
        const v = { x: 0.3, y: -0.7, z: 0.6 };
        const sequential = Rz.ofVector(Ry.ofVector(Rx.ofVector(v)));
        const actual = rpyToMatrix(roll, pitch, yaw).ofVector(v);
        expect(actual.x).toBeCloseTo(sequential.x, 7);
        expect(actual.y).toBeCloseTo(sequential.y, 7);
        expect(actual.z).toBeCloseTo(sequential.z, 7);
    });

    test("matrixToRpy inverts rpyToMatrix for several non-degenerate triples", () => {
        const cases = [
            [0, 0, 0],
            [0.5, 0.3, 0.2],
            [-0.4, 0.7, -1.1],
            [1.2, -0.6, 0.9],
        ];
        for (const [roll, pitch, yaw] of cases) {
            const rpy = matrixToRpy(rpyToMatrix(roll, pitch, yaw));
            expect(rpy.roll).toBeCloseTo(roll, 6);
            expect(rpy.pitch).toBeCloseTo(pitch, 6);
            expect(rpy.yaw).toBeCloseTo(yaw, 6);
        }
    });

    test("compound rotation differs from chili3d's internal fromEuler convention", () => {
        // The whole point of this module: for compound angles, URDF rpy != chili3d's Euler.
        const urdf = rpyToMatrix(0.5, 0.3, 0.2).toArray();
        const internal = Matrix4.fromEuler(0.5, 0.3, 0.2).toArray();
        let differs = false;
        for (let i = 0; i < 16; i++) {
            if (Math.abs(urdf[i] - internal[i]) > 1e-6) differs = true;
        }
        expect(differs).toBe(true);
    });
});
