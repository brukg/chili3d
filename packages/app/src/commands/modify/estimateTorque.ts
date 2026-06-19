// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    effortUtilization,
    gravityHoldingTorque,
    type IApplication,
    type ICommand,
    JointNode,
    NodeUtils,
    PubSub,
} from "@chili3d/core";
import { robotPointMasses, worldTransformOf } from "./robotModel";

/**
 * Estimate Torque: for every joint in the robot, the static gravity-holding torque its actuator must
 * supply (N·m) given the mass it carries downstream, compared against its rated `maxEffort`. This is
 * the motor-sizing check — "is each joint strong enough to hold the arm up?". One click reports the
 * peak (binding) joint as a toast and logs the full per-joint table to the console.
 *
 * Physics: each downstream link contributes a point mass at its geometry's world centre of mass, using
 * the link's authored {@link LinkNode.mass}. The torque is the gravitational moment about the joint's
 * world axis through its world pivot — see {@link gravityHoldingTorque}. Evaluated at the current pose,
 * in world coordinates, so the result is independent of how the robot is mounted.
 */
@command({
    key: "modify.estimateTorque",
    icon: "icon-measureSelect",
})
export class EstimateTorqueCommand implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const document = application.activeView?.document;
        if (!document) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const joints = NodeUtils.findNodes(
            document.modelManager.rootNode,
            (n) => n instanceof JointNode,
        ) as JointNode[];
        if (joints.length === 0) {
            PubSub.default.pub("showToast", "toast.robot.noJoints");
            return;
        }

        let peak: { joint: JointNode; torque: number; utilization: number } | undefined;
        for (const joint of joints) {
            const masses = robotPointMasses(joint);
            const axis = worldTransformOf(joint).ofVector(joint.axis);
            const pivot = worldTransformOf(joint).ofPoint(joint.pivot);
            const torque = gravityHoldingTorque(axis, pivot, masses);
            const utilization = effortUtilization(torque, joint.maxEffort);
            console.log(
                `[torque] ${joint.name}: ${Math.abs(torque).toFixed(3)} N·m required, ` +
                    `rated ${joint.maxEffort} N·m` +
                    (Number.isFinite(utilization) ? ` (${(utilization * 100).toFixed(0)}%)` : " (unrated)"),
            );
            if (!peak || Math.abs(torque) > Math.abs(peak.torque)) {
                peak = { joint, torque, utilization };
            }
        }

        if (!peak) return;
        const util = Number.isFinite(peak.utilization) ? `${(peak.utilization * 100).toFixed(0)}` : "—";
        PubSub.default.pub(
            "showToast",
            "toast.measure.torque:{0}{1}{2}{3}",
            peak.joint.name,
            Math.abs(peak.torque).toFixed(3),
            util,
            `${peak.joint.maxEffort}`,
        );
    }
}
