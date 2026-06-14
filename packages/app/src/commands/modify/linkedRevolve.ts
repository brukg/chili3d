// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CurveUtils,
    command,
    type IEdge,
    type ILine,
    type IShape,
    type IShapeFilter,
    type IStep,
    Line,
    SelectShapeStep,
    ShapeNode,
    type ShapeType,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { LinkedRevolveNode } from "../../bodys/linkedRevolve";
import { MultistepCommand } from "../multistepCommand";

/**
 * Non-destructive revolve: selects ONE profile shape plus an axis line but KEEPS the profile editable
 * and creates a {@link LinkedRevolveNode} referencing its id. Editing the profile rebuilds the solid of
 * revolution automatically through the referential-feature engine.
 */
@command({
    key: "modify.linkedRevolve",
    icon: "icon-revolve",
})
export class LinkedRevolveCommand extends MultistepCommand {
    protected override executeMainTask() {
        Transaction.execute(this.document, "linkedRevolve", () => {
            const profileId = this.stepDatas[0].nodes?.[0]?.id;
            if (!profileId) {
                return;
            }
            const edge = (this.stepDatas[1].shapes[0].shape as IEdge).curve.basisCurve as ILine;
            const transform = this.stepDatas[1].shapes[0].transform;
            const axis = new Line({
                point: transform.ofPoint(edge.value(0)),
                direction: transform.ofVector(edge.direction),
            });
            const node = new LinkedRevolveNode({
                document: this.document,
                profileId,
                axis,
                angle: 360,
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
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", {
                shapeFilter: new LineFilter(),
                keepSelection: true,
            }),
        ];
    }
}

class LineFilter implements IShapeFilter {
    allow(shape: IShape): boolean {
        if (shape.shapeType === ShapeTypes.edge) {
            const edge = shape as IEdge;
            const curve = edge.curve.basisCurve;
            return CurveUtils.isLine(curve);
        }
        return false;
    }
}
