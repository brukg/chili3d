// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    findMotorPreset,
    GetOrSelectNodeStep,
    type IStep,
    JointNode,
    MotorPresets,
    PubSub,
    property,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

const MOTOR_OPTIONS: readonly string[] = MotorPresets.map((p) => p.id);

/**
 * Apply Motor: assign an actuator preset (servo, stepper, BLDC, harmonic drive) to one or more joints,
 * setting their rated effort, gear ratio, rotor inertia, max velocity, and transmission efficiency in one
 * step. This is the joint-side analogue of Set Mass from Material — the specs feed Estimate Torque,
 * Payload Capacity, and the URDF `<transmission>`. The preset values are nominal starting points; refine
 * per joint afterwards.
 */
@command({
    key: "modify.applyMotor",
    icon: "icon-measureSelect",
})
export class ApplyMotorCommand extends MultistepCommand {
    @property("motor.preset", { type: "select", options: MOTOR_OPTIONS })
    get motor(): string {
        return this.getPrivateValue("motor", "standard-servo");
    }
    set motor(value: string) {
        this.setProperty("motor", value);
    }

    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.shape", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const joints = this.stepDatas[0].nodes?.filter((n) => n instanceof JointNode) as
            | JointNode[]
            | undefined;
        if (!joints || joints.length === 0) {
            PubSub.default.pub("showToast", "toast.robot.selectJoint");
            return;
        }
        const preset = findMotorPreset(this.motor);
        if (!preset) {
            PubSub.default.pub("showToast", "error.default:{0}", `unknown motor ${this.motor}`);
            return;
        }

        Transaction.execute(this.document, `execute ${Object.getPrototypeOf(this).data.name}`, () => {
            for (const joint of joints) {
                joint.maxEffort = preset.ratedTorque;
                joint.gearRatio = preset.gearRatio;
                joint.rotorInertia = preset.rotorInertia;
                joint.maxVelocity = preset.maxVelocity;
                joint.efficiency = preset.efficiency;
            }
        });
        PubSub.default.pub("showToast", "toast.robot.motorSet:{0}{1}", `${joints.length}`, preset.name);
    }
}
