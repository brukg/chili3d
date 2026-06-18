// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { curvature } from "../src/commands/measure/curvature";

describe("curvature", () => {
    test("a circle of radius 5 has curvature 1/5 (κ = |r′×r″|/|r′|³)", () => {
        // For r(θ)=5(cosθ,sinθ): r′=5(-sinθ,cosθ), r″=-5(cosθ,sinθ). At θ=0: r′=(0,5,0), r″=(-5,0,0).
        expect(curvature({ x: 0, y: 5, z: 0 }, { x: -5, y: 0, z: 0 })).toBeCloseTo(0.2, 10);
    });

    test("a straight line (zero second derivative) has zero curvature", () => {
        expect(curvature({ x: 3, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(0);
    });

    test("curvature is independent of parametrisation speed", () => {
        // Reparametrising at double speed scales r′ by 2 and r″ by 4 — κ is unchanged.
        const slow = curvature({ x: 0, y: 5, z: 0 }, { x: -5, y: 0, z: 0 });
        const fast = curvature({ x: 0, y: 10, z: 0 }, { x: -20, y: 0, z: 0 });
        expect(fast).toBeCloseTo(slow, 10);
    });
});
