// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

// Robot model validation (robot-building foundation). Catches the common modelling mistakes that make a
// robot fail to simulate or behave oddly — links with no mass, joints that aren't rated, empty joint
// ranges, joints driving nothing — before they reach URDF export or a physics engine. Pure checks over
// plain descriptors (the command gathers them from the node tree), so it is directly unit-testable.

/** A joint reduced to the fields validation looks at. */
export interface JointSpec {
    name: string;
    jointType: string;
    maxEffort: number;
    lowerLimit: number;
    upperLimit: number;
    gearRatio: number;
    hasChildLink: boolean;
}

/** A link reduced to the fields validation looks at. */
export interface LinkSpec {
    name: string;
    mass: number;
    hasGeometry: boolean;
    overrideInertia: boolean;
}

export interface RobotIssue {
    severity: "error" | "warning";
    /** The offending node's name, or "robot" for model-wide issues. */
    node: string;
    message: string;
}

// Joint types with a meaningful position range (so an empty lower/upper range is a real error). The
// others (continuous, planar, floating, fixed) carry no position limits.
const RANGE_LIMITED = new Set(["revolute", "prismatic"]);
// Joint types an actuator drives (so a zero effort rating is a real warning).
const ACTUATED = new Set(["revolute", "prismatic", "continuous"]);

/**
 * Validate a robot's links and joints, returning every issue found (empty array = a clean model). Errors
 * are problems that break export/simulation; warnings are suspicious but tolerable. Pure: pass plain
 * specs gathered from the model.
 */
export function validateRobot(links: readonly LinkSpec[], joints: readonly JointSpec[]): RobotIssue[] {
    const issues: RobotIssue[] = [];
    if (links.length === 0) {
        issues.push({ severity: "error", node: "robot", message: "robot has no links" });
    }

    for (const link of links) {
        if (!link.overrideInertia && link.mass <= 0) {
            issues.push({ severity: "warning", node: link.name, message: "link has zero mass" });
        }
        if (!link.hasGeometry && !link.overrideInertia) {
            issues.push({
                severity: "warning",
                node: link.name,
                message: "link has no geometry and no inertia override",
            });
        }
    }

    for (const joint of joints) {
        if (!joint.hasChildLink) {
            issues.push({ severity: "error", node: joint.name, message: "joint drives no child link" });
        }
        if (ACTUATED.has(joint.jointType) && joint.maxEffort <= 0) {
            issues.push({
                severity: "warning",
                node: joint.name,
                message: "joint is unrated (max effort 0)",
            });
        }
        if (joint.gearRatio <= 0) {
            issues.push({
                severity: "warning",
                node: joint.name,
                message: "joint has a non-positive gear ratio",
            });
        }
        if (RANGE_LIMITED.has(joint.jointType) && joint.lowerLimit >= joint.upperLimit) {
            issues.push({
                severity: "error",
                node: joint.name,
                message: "joint has an empty range (lower limit ≥ upper limit)",
            });
        }
    }

    return issues;
}
