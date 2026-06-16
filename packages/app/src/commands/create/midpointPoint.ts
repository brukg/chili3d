// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IEdge,
    type IStep,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { PointNode } from "../../bodys";
import { MultistepCommand } from "../multistepCommand";

// Point at Midpoint: drop a parametric construction point at the midpoint of each selected edge.
// The midpoint is taken from the curve's mid-parameter, so it is correct for arcs as well as lines
// (not just the chord midpoint) — Fusion's "point at midpoint".
@command({
    key: "create.midpointPoint",
    icon: "icon-point",
})
export class MidpointPoint extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const shapes = this.stepDatas[0].shapes;
        if (shapes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        Transaction.execute(this.document, "point at midpoint", () => {
            for (const data of shapes) {
                const edge = data.shape.transformedMul(data.transform) as IEdge;
                const curve = edge.curve;
                const mid = curve.value((curve.firstParameter() + curve.lastParameter()) / 2);
                const node = new PointNode({ document: this.document, position: mid });
                (data.owner.node?.parent ?? this.document.modelManager.rootNode).add(node);
            }
            this.document.visual.update();
        });
    }
}
