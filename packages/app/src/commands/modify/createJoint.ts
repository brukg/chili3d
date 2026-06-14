// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    BoundingBox,
    command,
    GetOrSelectNodeStep,
    type IStep,
    JointNode,
    Matrix4,
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

            // Pivot the joint at the node's centre (in the parent frame) so it rotates the
            // part in place rather than swinging it around the world origin. Compensate the
            // node's transform so it stays put at value 0: child' = origin⁻¹ · child.
            const center = BoundingBox.center(node.boundingBox());
            const origin = Matrix4.fromTranslation(center.x, center.y, center.z);
            const inverseOrigin = origin.invert();

            const joint = new JointNode({ document: this.document, name: "Joint", origin });
            if (inverseOrigin) {
                node.transform = inverseOrigin.multiply(node.transform);
            }
            parent.insertBefore(node, joint);
            parent.move(node, joint);
            this.document.visual.update();
        });
    }
}
