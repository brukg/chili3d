// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IStep,
    type LengthAtAxisSnapData,
    LengthAtAxisStep,
    Precision,
    SelectShapeStep,
    ShapeNode,
    type ShapeType,
    ShapeTypes,
    Transaction,
    type XYZ,
} from "@chili3d/core";
import { LinkedExtrudeNode } from "../../bodys/linkedExtrude";
import { MultistepCommand } from "../multistepCommand";

/**
 * Referential extrude: selects ONE profile (wire/edge/face — e.g. a SketchNode) but KEEPS the
 * profile editable and creates a {@link LinkedExtrudeNode} referencing its id. Editing the profile
 * rebuilds the solid automatically through the referential-feature engine (C4 → C1 chain).
 */
@command({
    key: "create.linkedExtrude",
    icon: "icon-prism",
})
export class LinkedExtrude extends MultistepCommand {
    protected override executeMainTask() {
        Transaction.execute(this.document, "linkedExtrude", () => {
            const profileId = this.stepDatas[0].nodes?.[0]?.id;
            if (!profileId) {
                return;
            }
            const { point, normal } = this.getAxis();
            const distance = this.stepDatas[1].point!.sub(point).dot(normal);
            const node = new LinkedExtrudeNode({
                document: this.document,
                profileId,
                direction: normal,
                distance,
            });
            this.document.modelManager.rootNode.add(node);
            this.document.visual.update();
        });
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(
                (ShapeTypes.face | ShapeTypes.edge | ShapeTypes.wire) as ShapeType,
                "prompt.select.shape",
                {
                    nodeFilter: { allow: (node) => node instanceof ShapeNode },
                },
            ),
            new LengthAtAxisStep("prompt.pickNextPoint", this.getLengthStepData, true),
        ];
    }

    private readonly getLengthStepData = (): LengthAtAxisSnapData => {
        const { point, normal } = this.getAxis();
        return {
            point,
            direction: normal,
            preview: (p) => {
                if (!p) return [];
                const dist = p.sub(point).dot(normal);
                if (Math.abs(dist) < Precision.Float) return [];
                return [this.meshLine(point, point.add(normal.multiply(dist)))];
            },
        };
    };

    private getAxis(): { point: XYZ; normal: XYZ } {
        const point = this.stepDatas[0].shapes[0].point!;
        const normal = this.stepDatas[0].view.workplane.normal;
        return { point, normal };
    }
}
