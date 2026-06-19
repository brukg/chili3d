// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    gravityHoldingTorque,
    type IApplication,
    type ICommand,
    inertiaAboutAxis,
    JointNode,
    maxAngularAcceleration,
    NodeUtils,
    PubSub,
    reflectedInertia,
    timeToReachSpeed,
} from "@chili3d/core";
import { robotPointMasses, worldTransformOf } from "./robotModel";

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Joint Dynamics: how fast can each joint accelerate its load? For every joint it forms the rotational
 * inertia about the axis — the downstream links as point masses plus the motor's reflected rotor inertia
 * (`rotorInertia · gearRatio²`) — and divides the spare torque (`maxEffort − gravity hold`) by it to get
 * the peak angular acceleration. The slowest (binding) joint is reported as a toast, with the full
 * per-joint table logged to the console. Pairs with Apply Motor: rotor inertia and gearing come from the
 * assigned actuator.
 */
@command({
    key: "modify.jointDynamics",
    icon: "icon-measureSelect",
})
export class JointDynamicsCommand implements ICommand {
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

        let slowest: { joint: JointNode; accel: number } | undefined;
        for (const joint of joints) {
            const axis = worldTransformOf(joint).ofVector(joint.axis);
            const pivot = worldTransformOf(joint).ofPoint(joint.pivot);
            const masses = robotPointMasses(joint);
            const selfLoad = Math.abs(gravityHoldingTorque(axis, pivot, masses));
            const available = joint.maxEffort - selfLoad;
            const inertia =
                inertiaAboutAxis(axis, pivot, masses) + reflectedInertia(joint.rotorInertia, joint.gearRatio);
            const accel = maxAngularAcceleration(available, inertia); // rad/s²

            const deg = Number.isFinite(accel) ? (accel * RAD_TO_DEG).toFixed(1) : "∞";
            const reachTime = timeToReachSpeed(joint.maxVelocity, accel);
            const t = Number.isFinite(reachTime) ? `${reachTime.toFixed(2)}s` : "∞";
            console.log(
                `[dynamics] ${joint.name}: max ${deg} deg/s², ${t} to max speed ` +
                    `(inertia ${inertia.toFixed(5)} kg·m², spare ${available.toFixed(3)} N·m)`,
            );
            if (!slowest || accel < slowest.accel) slowest = { joint, accel };
        }

        if (!slowest) return;
        const deg = Number.isFinite(slowest.accel) ? (slowest.accel * RAD_TO_DEG).toFixed(1) : "∞";
        const reachTime = timeToReachSpeed(slowest.joint.maxVelocity, slowest.accel);
        const t = Number.isFinite(reachTime) ? reachTime.toFixed(2) : "∞";
        PubSub.default.pub("showToast", "toast.robot.dynamics:{0}{1}{2}", deg, slowest.joint.name, t);
    }
}
