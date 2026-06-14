// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    BoundingBox,
    command,
    GetOrSelectNodeStep,
    type IStep,
    JointNode,
    Transaction,
    VisualNode,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "modify.createJoint",
    icon: "icon-fillet",
})
export class CreateJointCommand extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.shape", { multiple: false })];
    }

    protected override executeMainTask(): void {
        const nodes = this.stepDatas[0].nodes?.filter((node) => node instanceof VisualNode);
        if (!nodes || nodes.length === 0) {
            return;
        }
        Transaction.execute(this.document, `execute ${Object.getPrototypeOf(this).data.name}`, () => {
            const node = nodes[0];
            const parent = node.parent ?? this.document.modelManager.rootNode;

            // Default the rotation point to the part's centre. The part is NOT moved or
            // compensated — the joint transform is identity at value 0, so wrapping it changes
            // nothing visually; the user can then move the rotation point or actuate the joint.
            const center = BoundingBox.center(node.boundingBox());
            const joint = new JointNode({ document: this.document, name: "Joint", pivot: center });
            parent.insertBefore(node, joint);
            parent.move(node, joint);
            this.document.visual.update();
        });
    }
}
