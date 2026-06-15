// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import type { Vec3 } from "../src/urdf/convexHull";
import { meshInertiaTensor } from "../src/urdf/meshInertia";

// 12 triangles for an axis-aligned box of full sizes (sx,sy,sz) centred at the origin.
function boxMesh(sx: number, sy: number, sz: number, rotateZ = 0): Vec3[] {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const c: Vec3[] = [
        [-hx, -hy, -hz],
        [hx, -hy, -hz],
        [hx, hy, -hz],
        [-hx, hy, -hz],
        [-hx, -hy, hz],
        [hx, -hy, hz],
        [hx, hy, hz],
        [-hx, hy, hz],
    ];
    const cz = Math.cos(rotateZ);
    const sz2 = Math.sin(rotateZ);
    const r = c.map((p): Vec3 => [p[0] * cz - p[1] * sz2, p[0] * sz2 + p[1] * cz, p[2]]);
    const quads = [
        [0, 1, 2, 3], // bottom (-z)
        [4, 7, 6, 5], // top (+z)
        [0, 4, 5, 1], // -y
        [1, 5, 6, 2], // +x
        [2, 6, 7, 3], // +y
        [3, 7, 4, 0], // -x
    ];
    const out: Vec3[] = [];
    for (const [a, b, d, e] of quads) {
        out.push(r[a], r[b], r[d], r[a], r[d], r[e]);
    }
    return out;
}

describe("meshInertiaTensor", () => {
    test("axis-aligned box: exact diagonal, zero products (cross-checks the OCCT diagonal of 650000)", () => {
        const t = meshInertiaTensor(boxMesh(10, 20, 30), [0, 0, 0]);
        const V = 6000;
        expect(t.volume).toBeCloseTo(V, 3);
        // Iuu = V/12·(other two sides²); unit density so mass = volume.
        expect(t.ixx).toBeCloseTo((V / 12) * (20 ** 2 + 30 ** 2), 3); // 650000
        expect(t.iyy).toBeCloseTo((V / 12) * (10 ** 2 + 30 ** 2), 3); // 500000
        expect(t.izz).toBeCloseTo((V / 12) * (10 ** 2 + 20 ** 2), 3); // 250000
        expect(t.ixy).toBeCloseTo(0, 6);
        expect(t.ixz).toBeCloseTo(0, 6);
        expect(t.iyz).toBeCloseTo(0, 6);
    });

    test("a box rotated 45° about Z develops the analytically-correct product of inertia", () => {
        const V = 6000;
        const ixx0 = (V / 12) * (20 ** 2 + 30 ** 2); // principal, box-aligned
        const iyy0 = (V / 12) * (10 ** 2 + 30 ** 2);
        const theta = Math.PI / 4;

        const t = meshInertiaTensor(boxMesh(10, 20, 30, theta), [0, 0, 0]);

        // Rotating the inertia tensor about Z by θ: Ixy = (Ixx0 − Iyy0)·sinθ·cosθ.
        const expectedIxy = (ixx0 - iyy0) * Math.sin(theta) * Math.cos(theta);
        expect(t.ixy).toBeCloseTo(expectedIxy, 3);
        // Z is the rotation axis, so xz / yz products stay zero and Izz is unchanged.
        expect(t.ixz).toBeCloseTo(0, 6);
        expect(t.iyz).toBeCloseTo(0, 6);
        expect(t.izz).toBeCloseTo((V / 12) * (10 ** 2 + 20 ** 2), 3);
    });

    test("translating an axis-aligned box keeps products zero about its own COM", () => {
        const verts = boxMesh(10, 20, 30).map((p): Vec3 => [p[0] + 100, p[1] - 50, p[2] + 7]);
        const t = meshInertiaTensor(verts, [100, -50, 7]); // about the shifted COM
        expect(t.ixy).toBeCloseTo(0, 5);
        expect(t.ixz).toBeCloseTo(0, 5);
        expect(t.iyz).toBeCloseTo(0, 5);
        expect(t.ixx).toBeCloseTo((6000 / 12) * (20 ** 2 + 30 ** 2), 3);
    });
});
