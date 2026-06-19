// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IApplication,
    type ICommand,
    JointNode,
    type JointSpec,
    LinkNode,
    type LinkSpec,
    NodeUtils,
    PubSub,
    validateRobot,
} from "@chili3d/core";
import { linkWorldSolids } from "./robotModel";

/**
 * Validate Robot: check the robot model for the mistakes that break or degrade export/simulation —
 * zero-mass or geometry-less links, unrated or rangeless joints, joints driving nothing — and report them.
 * "Robot valid" when clean; otherwise the error/warning counts go to a toast and the full annotated list to
 * the console. Runs the pure {@link validateRobot} core over specs gathered from the node tree.
 */
@command({
    key: "modify.validateRobot",
    icon: "icon-measureSelect",
})
export class ValidateRobotCommand implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const document = application.activeView?.document;
        if (!document) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const root = document.modelManager.rootNode;
        const links = NodeUtils.findNodes(root, (n) => n instanceof LinkNode) as LinkNode[];
        const joints = NodeUtils.findNodes(root, (n) => n instanceof JointNode) as JointNode[];

        const linkSpecs: LinkSpec[] = links.map((link) => ({
            name: link.name,
            mass: link.mass,
            hasGeometry: linkWorldSolids(link).length > 0,
            overrideInertia: link.overrideInertia,
        }));
        const jointSpecs: JointSpec[] = joints.map((joint) => ({
            name: joint.name,
            jointType: joint.jointType,
            maxEffort: joint.maxEffort,
            lowerLimit: joint.lowerLimit,
            upperLimit: joint.upperLimit,
            gearRatio: joint.gearRatio,
            hasChildLink: NodeUtils.findNodes(joint, (n) => n instanceof LinkNode).length > 0,
        }));

        const issues = validateRobot(linkSpecs, jointSpecs);
        if (issues.length === 0) {
            PubSub.default.pub("showToast", "toast.robot.valid");
            return;
        }
        for (const issue of issues) {
            console.log(`[validate] ${issue.severity.toUpperCase()} ${issue.node}: ${issue.message}`);
        }
        const errors = issues.filter((i) => i.severity === "error").length;
        PubSub.default.pub(
            "showToast",
            "toast.robot.invalid:{0}{1}",
            `${errors}`,
            `${issues.length - errors}`,
        );
    }
}
