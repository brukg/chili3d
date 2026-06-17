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

// Point at Intersection: drop a parametric construction point wherever two selected edges cross —
// Fusion's "point at intersection". Produces one point per intersection (none if the edges miss).
@command({
    key: "create.intersectionPoint",
    icon: "icon-point",
})
export class IntersectionPoint extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const shapes = this.stepDatas[0].shapes;
        if (shapes.length !== 2) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const a = shapes[0].shape.transformedMul(shapes[0].transform) as IEdge;
        const b = shapes[1].shape.transformedMul(shapes[1].transform) as IEdge;
        const hits = a.intersect(b);
        if (hits.length === 0) {
            PubSub.default.pub("showToast", "toast.converter.error");
            return;
        }

        Transaction.execute(this.document, "point at intersection", () => {
            for (const hit of hits) {
                this.document.modelManager.rootNode.add(
                    new PointNode({ document: this.document, position: hit.point }),
                );
            }
            this.document.visual.update();
        });
    }
}
