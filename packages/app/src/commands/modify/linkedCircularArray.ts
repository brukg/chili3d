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
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { LinkedCircularArrayNode } from "../../bodys/linkedCircularArray";
import { MultistepCommand } from "../multistepCommand";

/**
 * Non-destructive circular pattern: selects ONE source shape plus an axis line but KEEPS the input
 * editable and creates a {@link LinkedCircularArrayNode} referencing its id. Editing the source
 * rebuilds the ring automatically through the referential-feature engine.
 */
@command({
    key: "modify.linkedCircularArray",
    icon: "icon-array",
})
export class LinkedCircularArrayCommand extends MultistepCommand {
    protected override executeMainTask() {
        Transaction.execute(this.document, "linkedCircularArray", () => {
            const sourceId = this.stepDatas[0].nodes?.[0]?.id;
            if (!sourceId) {
                return;
            }
            const edge = (this.stepDatas[1].shapes[0].shape as IEdge).curve.basisCurve as ILine;
            const transform = this.stepDatas[1].shapes[0].transform;
            const axis = new Line({
                point: transform.ofPoint(edge.value(0)),
                direction: transform.ofVector(edge.direction),
            });
            const node = new LinkedCircularArrayNode({
                document: this.document,
                sourceId,
                axis,
                count: 4,
                angle: 360,
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
