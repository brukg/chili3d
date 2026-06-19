// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    gravityHoldingTorque,
    type IApplication,
    type ICommand,
    type IVertex,
    JointNode,
    maxPayloadMass,
    NodeUtils,
    PubSub,
    ShapeTypes,
    STANDARD_GRAVITY,
    type XYZLike,
} from "@chili3d/core";
import { robotPointMasses, robotWorldSolids, worldTransformOf } from "./robotModel";

/**
 * Payload Capacity: how much mass the robot can hold at its end effector before some joint runs out of
 * torque. For each joint it takes the rated `maxEffort`, subtracts the torque already spent holding the
 * arm's own weight, and divides the remainder by the torque-per-kilogram a payload would add at the
 * farthest downstream point (the end-effector proxy). The binding (smallest-payload) joint sets the
 * robot's capacity; it is reported as a toast, with the full per-joint table logged to the console.
 */
@command({
    key: "modify.payloadCapacity",
    icon: "icon-measureSelect",
})
export class PayloadCapacityCommand implements ICommand {
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

        let limiting: { joint: JointNode; payload: number } | undefined;
        for (const joint of joints) {
            const axis = worldTransformOf(joint).ofVector(joint.axis);
            const pivot = worldTransformOf(joint).ofPoint(joint.pivot);
            const tip = this.farthestDownstreamPoint(joint, pivot);
            if (!tip) continue; // no geometry downstream → no defined payload point

            const selfLoad = Math.abs(gravityHoldingTorque(axis, pivot, robotPointMasses(joint)));
            const available = joint.maxEffort - selfLoad;
            // Torque a 1 kg payload at the tip adds about the axis (N·m); its lever arm is that / g.
            const perKg = Math.abs(gravityHoldingTorque(axis, pivot, [{ center: tip, mass: 1 }]));
            const leverArm = (perKg / STANDARD_GRAVITY) * 1000; // metres → millimetres
            const payload = maxPayloadMass(available, leverArm);

            console.log(
                `[payload] ${joint.name}: ${Number.isFinite(payload) ? payload.toFixed(3) : "∞"} kg ` +
                    `(rated ${joint.maxEffort} N·m, self-load ${selfLoad.toFixed(3)} N·m)`,
            );
            if (!limiting || payload < limiting.payload) limiting = { joint, payload };
        }

        if (!limiting) {
            PubSub.default.pub("showToast", "toast.robot.noLinks");
            return;
        }
        const value = Number.isFinite(limiting.payload) ? limiting.payload.toFixed(3) : "∞";
        PubSub.default.pub("showToast", "toast.robot.payload:{0}{1}", value, limiting.joint.name);
    }

    // The downstream geometry vertex farthest from the joint pivot — a proxy for the end effector.
    private farthestDownstreamPoint(joint: JointNode, pivot: XYZLike): XYZLike | undefined {
        let best: XYZLike | undefined;
        let bestDistSq = -1;
        for (const solid of robotWorldSolids(joint)) {
            for (const v of solid.findSubShapes(ShapeTypes.vertex)) {
                const p = (v as IVertex).point();
                const dx = p.x - pivot.x;
                const dy = p.y - pivot.y;
                const dz = p.z - pivot.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq > bestDistSq) {
                    bestDistSq = distSq;
                    best = { x: p.x, y: p.y, z: p.z };
                }
            }
        }
        return best;
    }
}
