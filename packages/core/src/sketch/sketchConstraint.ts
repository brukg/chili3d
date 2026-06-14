// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { evaluateExpression } from "../foundation";
import {
    angle,
    type Constraint,
    coincident,
    distance,
    distanceX,
    distanceY,
    equalLength,
    fixed,
    horizontal,
    parallel,
    perpendicular,
    pointOnLine,
    vertical,
} from "./constraintSolver";

/**
 * A dimension value: a literal number, or a string expression evaluated against the document's
 * named parameters (e.g. `"width / 2"`). Expression-valued dimensions are what make a sketch
 * parameter-driven — changing a parameter resizes the sketch.
 */
export type SketchDimension = number | string;

/**
 * A serializable, plain-data description of a sketch constraint. The live {@link Constraint}
 * objects produced by the solver carry closures and cannot be serialized, so persisted sketches
 * store these descriptors and map them back via {@link toConstraint} when they are solved.
 */
export type SketchConstraint =
    | { type: "fixed"; point: number; x: SketchDimension; y: SketchDimension }
    | { type: "coincident"; a: number; b: number }
    | { type: "distance"; a: number; b: number; d: SketchDimension }
    | { type: "horizontal"; a: number; b: number }
    | { type: "vertical"; a: number; b: number }
    | { type: "parallel"; a: number; b: number; c: number; d: number }
    | { type: "perpendicular"; a: number; b: number; c: number; d: number }
    | { type: "equalLength"; a: number; b: number; c: number; d: number }
    | { type: "pointOnLine"; point: number; a: number; b: number }
    | { type: "distanceX"; a: number; b: number; dx: SketchDimension }
    | { type: "distanceY"; a: number; b: number; dy: SketchDimension }
    | { type: "angle"; a: number; b: number; c: number; d: number; radians: SketchDimension };

/**
 * Map a serializable {@link SketchConstraint} descriptor to a live solver {@link Constraint},
 * evaluating any expression-valued dimensions against the supplied parameter `scope`.
 */
export function toConstraint(c: SketchConstraint, scope: Record<string, number> = {}): Constraint {
    const num = (value: SketchDimension): number => {
        if (typeof value === "number") return value;
        const result = evaluateExpression(value, scope);
        return result.isOk ? result.value : 0;
    };
    switch (c.type) {
        case "fixed":
            return fixed(c.point, num(c.x), num(c.y));
        case "coincident":
            return coincident(c.a, c.b);
        case "distance":
            return distance(c.a, c.b, num(c.d));
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
        case "distanceX":
            return distanceX(c.a, c.b, num(c.dx));
        case "distanceY":
            return distanceY(c.a, c.b, num(c.dy));
        case "angle":
            return angle(c.a, c.b, c.c, c.d, num(c.radians));
    }
}
