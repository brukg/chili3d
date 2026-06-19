// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    combinedCenterOfMass,
    command,
    effortUtilization,
    gravityHoldingTorque,
    type IApplication,
    type ICommand,
    JointNode,
    LinkNode,
    mechanicalPower,
    NodeUtils,
    PubSub,
    totalMass,
} from "@chili3d/core";
import { robotPointMasses, worldTransformOf } from "./robotModel";

/**
 * Robot Report: a one-click spec sheet of the whole robot, consolidating the individual analyses — link
 * and joint counts, total mass and centre of mass, total installed mechanical power, and the peak torque
 * utilization across the joints (the most loaded actuator vs its rated effort). The headline numbers go to
 * a toast; the full per-joint breakdown and exact figures are logged to the console.
 */
@command({
    key: "modify.robotReport",
    icon: "icon-measureSelect",
})
export class RobotReportCommand implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const document = application.activeView?.document;
        if (!document) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const root = document.modelManager.rootNode;
        const links = NodeUtils.findNodes(root, (n) => n instanceof LinkNode) as LinkNode[];
        const joints = NodeUtils.findNodes(root, (n) => n instanceof JointNode) as JointNode[];
        if (links.length === 0) {
            PubSub.default.pub("showToast", "toast.robot.noLinks");
            return;
        }

        const masses = robotPointMasses(root);
        const mass = totalMass(masses);
        const com = combinedCenterOfMass(masses);

        let totalPower = 0;
        let peakUtil = 0;
        for (const joint of joints) {
            totalPower += mechanicalPower(joint.maxEffort, joint.maxVelocity);
            const axis = worldTransformOf(joint).ofVector(joint.axis);
            const pivot = worldTransformOf(joint).ofPoint(joint.pivot);
            const torque = gravityHoldingTorque(axis, pivot, robotPointMasses(joint));
            const util = effortUtilization(torque, joint.maxEffort);
            if (Number.isFinite(util) && util > peakUtil) peakUtil = util;
        }

        console.log(
            `[report] ${links.length} links, ${joints.length} joints, mass ${mass.toFixed(4)} kg, ` +
                `COM (${com ? `${com.x.toFixed(1)}, ${com.y.toFixed(1)}, ${com.z.toFixed(1)}` : "—"}) mm, ` +
                `installed power ${totalPower.toFixed(1)} W, peak torque ${(peakUtil * 100).toFixed(0)}%`,
        );
        PubSub.default.pub(
            "showToast",
            "toast.robot.report:{0}{1}{2}{3}",
            `${joints.length}`,
            mass.toFixed(3),
            totalPower.toFixed(1),
            (peakUtil * 100).toFixed(0),
        );
    }
}
