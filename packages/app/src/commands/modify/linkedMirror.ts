// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IStep,
    Plane,
    PointStep,
    SelectShapeStep,
    ShapeNode,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { LinkedMirrorNode } from "../../bodys/linkedMirror";
import { MultistepCommand } from "../multistepCommand";

/**
 * Non-destructive mirror: selects ONE source shape and a point that, together with the view's working
 * plane normal, defines the mirror plane. KEEPS the input editable and creates a {@link LinkedMirrorNode}
 * referencing its id. Editing the source rebuilds the reflected copy through the referential-feature engine.
 */
@command({
    key: "modify.linkedMirror",
    icon: "icon-mirror",
})
export class LinkedMirrorCommand extends MultistepCommand {
    protected override executeMainTask() {
        Transaction.execute(this.document, "linkedMirror", () => {
            const sourceId = this.stepDatas[0].nodes?.[0]?.id;
            if (!sourceId) {
                return;
            }
            const origin = this.stepDatas[1].point!;
            const normal = this.stepDatas[1].view.workplane.normal;
            const plane = new Plane({ origin, normal, xvec: this.stepDatas[1].view.workplane.xvec });
            const node = new LinkedMirrorNode({
                document: this.document,
                sourceId,
                plane,
            });
            this.document.modelManager.rootNode.add(node);
            this.document.visual.update();
        });
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape", {
                nodeFilter: { allow: (node) => node instanceof ShapeNode },
            }),
            new PointStep("prompt.pickFistPoint", undefined, true),
        ];
    }
}
