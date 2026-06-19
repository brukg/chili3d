// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IApplication,
    type ICommand,
    JointNode,
    mechanicalPower,
    NodeUtils,
    PubSub,
} from "@chili3d/core";

/**
 * Power Budget: the robot's installed mechanical power. Each joint's peak shaft power is its rated effort
 * times its max velocity (`maxEffort · maxVelocity`); summed over the joints it is the total power the
 * actuators can draw at once — the number to size a battery or power supply against. Reports the total and
 * the single hungriest joint as a toast, with the full per-joint table in the console.
 */
@command({
    key: "modify.powerBudget",
    icon: "icon-measureSelect",
})
export class PowerBudgetCommand implements ICommand {
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

        let total = 0;
        let peak: { joint: JointNode; power: number } | undefined;
        for (const joint of joints) {
            const power = mechanicalPower(joint.maxEffort, joint.maxVelocity); // W
            total += power;
            console.log(
                `[power] ${joint.name}: ${power.toFixed(2)} W ` +
                    `(${joint.maxEffort} N·m × ${joint.maxVelocity} rad/s)`,
            );
            if (!peak || power > peak.power) peak = { joint, power };
        }

        if (!peak) return;
        PubSub.default.pub(
            "showToast",
            "toast.robot.power:{0}{1}{2}",
            total.toFixed(2),
            peak.joint.name,
            peak.power.toFixed(2),
        );
    }
}
