// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    Dimensions,
    type IStep,
    Matrix4,
    type PointSnapData,
    PointStep,
    SelectShapeStep,
    ShapeNode,
    ShapeTypes,
    Transaction,
    type XYZ,
} from "@chili3d/core";
import { LinkedTransformNode } from "../../bodys/linkedTransform";
import { MultistepCommand } from "../multistepCommand";

/**
 * Non-destructive move: selects ONE source shape but KEEPS the input editable and creates a
 * {@link LinkedTransformNode} referencing its id with a stored translation. Editing the source
 * rebuilds the transformed copy automatically through the referential-feature engine.
 */
@command({
    key: "modify.linkedMove",
    icon: "icon-move",
})
export class LinkedMove extends MultistepCommand {
    protected override executeMainTask() {
        Transaction.execute(this.document, "linkedMove", () => {
            const sourceId = this.stepDatas[0].nodes?.[0]?.id;
            if (!sourceId) {
                return;
            }
            const from = this.stepDatas[1].point!;
            const to = this.stepDatas[2].point!;
            const appliedTransform = Matrix4.fromTranslation(to.x - from.x, to.y - from.y, to.z - from.z);
            const node = new LinkedTransformNode({
                document: this.document,
                sourceId,
                appliedTransform,
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
            new PointStep("prompt.pickNextPoint", this.getSecondPointData, true),
        ];
    }

    private readonly getSecondPointData = (): PointSnapData => {
        return {
            refPoint: () => this.stepDatas[1].point!,
            dimension: Dimensions.D1D2D3,
            preview: (point: XYZ | undefined) => {
                const p1 = this.meshPoint(this.stepDatas[1].point!);
                if (!point) return [p1];
                return [p1, this.meshPoint(point), this.meshLine(this.stepDatas[1].point!, point)];
            },
        };
    };
}
