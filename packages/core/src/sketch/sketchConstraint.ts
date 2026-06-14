// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type Constraint,
    coincident,
    distance,
    equalLength,
    fixed,
    horizontal,
    parallel,
    perpendicular,
    pointOnLine,
    vertical,
} from "./constraintSolver";

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
    | { type: "vertical"; a: number; b: number }
    | { type: "parallel"; a: number; b: number; c: number; d: number }
    | { type: "perpendicular"; a: number; b: number; c: number; d: number }
    | { type: "equalLength"; a: number; b: number; c: number; d: number }
    | { type: "pointOnLine"; point: number; a: number; b: number };

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
        case "parallel":
            return parallel(c.a, c.b, c.c, c.d);
        case "perpendicular":
            return perpendicular(c.a, c.b, c.c, c.d);
        case "equalLength":
            return equalLength(c.a, c.b, c.c, c.d);
        case "pointOnLine":
            return pointOnLine(c.point, c.a, c.b);
    }
}
