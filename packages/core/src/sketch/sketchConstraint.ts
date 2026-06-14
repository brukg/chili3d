// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type Constraint, coincident, distance, fixed, horizontal, vertical } from "./constraintSolver";

/**
 * A serializable, plain-data description of a sketch constraint. The live {@link Constraint}
 * objects produced by the solver carry closures and cannot be serialized, so persisted sketches
 * store these descriptors and map them back via {@link toConstraint} when they are solved.
 */
export type SketchConstraint =
    | { type: "fixed"; point: number; x: number; y: number }
    | { type: "coincident"; a: number; b: number }
    | { type: "distance"; a: number; b: number; d: number }
    | { type: "horizontal"; a: number; b: number }
    | { type: "vertical"; a: number; b: number };

/** Map a serializable {@link SketchConstraint} descriptor to a live solver {@link Constraint}. */
export function toConstraint(c: SketchConstraint): Constraint {
    switch (c.type) {
        case "fixed":
            return fixed(c.point, c.x, c.y);
        case "coincident":
            return coincident(c.a, c.b);
        case "distance":
            return distance(c.a, c.b, c.d);
        case "horizontal":
            return horizontal(c.a, c.b);
        case "vertical":
            return vertical(c.a, c.b);
    }
}
