// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { principalMoments } from "../src/commands/measure/principalInertia";

describe("principalMoments", () => {
    test("a diagonal tensor returns its diagonal, sorted ascending", () => {
        expect(principalMoments(5, 2, 3, 0, 0, 0)).toEqual([2, 3, 5]);
    });

    test("rotation invariance: diag(2,3,5) rotated 45° about z recovers {2,3,5}", () => {
        // R·diag(2,3,5)·Rᵀ for a 45° z-rotation: ixx=iyy=2.5, izz=5, ixy=-0.5, ixz=iyz=0.
        const [a, b, c] = principalMoments(2.5, 2.5, 5, -0.5, 0, 0);
        expect(a).toBeCloseTo(2, 10);
        expect(b).toBeCloseTo(3, 10);
        expect(c).toBeCloseTo(5, 10);
    });

    test("matches the analytic eigenvalues of a fully-coupled tensor", () => {
        // [[2,1,1],[1,2,1],[1,1,2]] has eigenvalues {1, 1, 4}.
        const [a, b, c] = principalMoments(2, 2, 2, 1, 1, 1);
        expect(a).toBeCloseTo(1, 10);
        expect(b).toBeCloseTo(1, 10);
        expect(c).toBeCloseTo(4, 10);
    });
});
