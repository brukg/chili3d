// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type INode, type IStep, JointNode, PointStep, PubSub, Transaction } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

/**
 * Set a joint's rotation centre (pivot) by clicking a point on the part. The pivot is purely the
 * centre the joint rotates about — placing it does NOT move the part (at the rest pose the joint
 * transform is identity for any pivot). Click snaps to the part's corners/edges/face centres.
 */
@command({
    key: "modify.setJointPivot",
    icon: "icon-fillet",
})
export class SetJointPivotCommand extends MultistepCommand {
    private joint?: JointNode;

    protected override async canExcute(): Promise<boolean> {
        const joint = this.document.selection
            .getSelectedNodes()
            .map((node) => SetJointPivotCommand.enclosingJoint(node))
            .find((found): found is JointNode => found !== undefined);
        if (!joint) {
            PubSub.default.pub("showToast", "prompt.select.joint");
            return false;
        }
        this.joint = joint;
        return true;
    }

    private static enclosingJoint(node: INode): JointNode | undefined {
        let current: INode | undefined = node;
        while (current) {
            if (current instanceof JointNode) return current;
            current = current.parent;
        }
        return undefined;
    }

    protected override getSteps(): IStep[] {
        return [new PointStep("prompt.pickRotationPoint")];
    }

    protected override executeMainTask(): void {
        const point = this.stepDatas[0]?.point;
        const joint = this.joint;
        if (!point || !joint) return;
        Transaction.execute(this.document, "set rotation point", () => {
            // Convert the picked world point into the joint's own frame and store it as the centre of
            // rotation. At the rest pose this never moves the part — only the centre relocates.
            const world = this.document.visual.context.getVisual(joint)?.worldTransform();
            const toLocal = world?.invert();
            joint.pivot = toLocal ? toLocal.ofPoint(point) : point;
            this.document.visual.update();
        });
    }
}
