// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { type JointSpec, type LinkSpec, validateRobot } from "../src/robot/validate";

const goodLink: LinkSpec = { name: "l", mass: 1, hasGeometry: true, overrideInertia: false };
const goodJoint: JointSpec = {
    name: "j",
    jointType: "revolute",
    maxEffort: 10,
    lowerLimit: -90,
    upperLimit: 90,
    gearRatio: 1,
    hasChildLink: true,
};

describe("robot validation", () => {
    test("a well-formed robot has no issues", () => {
        expect(validateRobot([goodLink], [goodJoint])).toEqual([]);
    });

    test("no links is an error", () => {
        const issues = validateRobot([], [goodJoint]);
        expect(issues).toContainEqual({ severity: "error", node: "robot", message: "robot has no links" });
    });

    test("zero-mass and geometry-less links warn (unless inertia is overridden)", () => {
        const issues = validateRobot(
            [{ name: "l", mass: 0, hasGeometry: false, overrideInertia: false }],
            [],
        );
        expect(issues.filter((i) => i.node === "l")).toHaveLength(2);
        expect(issues.every((i) => i.severity === "warning")).toBe(true);
        // an inertia override suppresses both
        expect(
            validateRobot([{ name: "l", mass: 0, hasGeometry: false, overrideInertia: true }], []),
        ).toEqual([]);
    });

    test("an unrated actuated joint warns, a fixed joint does not", () => {
        const unrated = validateRobot([goodLink], [{ ...goodJoint, maxEffort: 0 }]);
        expect(unrated).toContainEqual({
            severity: "warning",
            node: "j",
            message: "joint is unrated (max effort 0)",
        });
        const fixed = validateRobot(
            [goodLink],
            [{ ...goodJoint, jointType: "fixed", maxEffort: 0, lowerLimit: 0, upperLimit: 0 }],
        );
        expect(fixed).toEqual([]);
    });

    test("an empty position range is an error for revolute/prismatic only", () => {
        const bad = validateRobot([goodLink], [{ ...goodJoint, lowerLimit: 90, upperLimit: -90 }]);
        expect(bad).toContainEqual({
            severity: "error",
            node: "j",
            message: "joint has an empty range (lower limit ≥ upper limit)",
        });
        // continuous joints have no range, so equal limits are fine
        const cont = validateRobot(
            [goodLink],
            [{ ...goodJoint, jointType: "continuous", lowerLimit: 0, upperLimit: 0 }],
        );
        expect(cont).toEqual([]);
    });

    test("a joint driving no link is an error", () => {
        const issues = validateRobot([goodLink], [{ ...goodJoint, hasChildLink: false }]);
        expect(issues).toContainEqual({
            severity: "error",
            node: "j",
            message: "joint drives no child link",
        });
    });

    test("a non-positive gear ratio warns", () => {
        const issues = validateRobot([goodLink], [{ ...goodJoint, gearRatio: 0 }]);
        expect(issues).toContainEqual({
            severity: "warning",
            node: "j",
            message: "joint has a non-positive gear ratio",
        });
    });
});
