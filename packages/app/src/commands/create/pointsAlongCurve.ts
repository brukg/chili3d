// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IEdge,
    type IStep,
    PubSub,
    property,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { PointNode } from "../../bodys";
import { MultistepCommand } from "../multistepCommand";

// Points Along Curve: drop equally-spaced construction points along each selected edge/wire (Fusion's
// "points along path"). `count` is the number of equal segments — giving count+1 points, including the
// two ends — spaced by true arc length, so arcs and splines are divided evenly along the curve.
@command({
    key: "create.pointsAlongCurve",
    icon: "icon-point",
})
export class PointsAlongCurve extends MultistepCommand {
    @property("common.count")
    get count() {
        return this.getPrivateValue("count", 5);
    }
    set count(value: number) {
        this.setProperty("count", value);
    }

    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const shapes = this.stepDatas[0].shapes;
        if (shapes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const segments = Math.max(1, Math.floor(this.count));
        Transaction.execute(this.document, "points along curve", () => {
            for (const data of shapes) {
                const edge = data.shape.transformedMul(data.transform) as IEdge;
                for (const position of edge.curve.uniformAbscissaByCount(segments)) {
                    const node = new PointNode({ document: this.document, position });
                    (data.owner.node?.parent ?? this.document.modelManager.rootNode).add(node);
                }
            }
            this.document.visual.update();
        });
        PubSub.default.pub("showToast", "toast.success");
    }
}
