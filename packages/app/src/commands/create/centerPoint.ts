// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CurveUtils,
    command,
    type ICurve,
    type IEdge,
    type IStep,
    type ITrimmedCurve,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
    type XYZ,
} from "@chili3d/core";
import { PointNode } from "../../bodys";
import { MultistepCommand } from "../multistepCommand";

// Point at Center: drop a parametric construction point at the centre of each selected circular edge
// (a circle or arc) — Fusion's "point at centre". Non-circular edges are skipped.
@command({
    key: "create.centerPoint",
    icon: "icon-point",
})
export class CenterPoint extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const shapes = this.stepDatas[0].shapes;
        if (shapes.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        let created = 0;
        Transaction.execute(this.document, "point at center", () => {
            for (const data of shapes) {
                const edge = data.shape.transformedMul(data.transform) as IEdge;
                const center = this.circleCenter(edge.curve);
                if (!center) continue;
                const node = new PointNode({ document: this.document, position: center });
                (data.owner.node?.parent ?? this.document.modelManager.rootNode).add(node);
                created++;
            }
            this.document.visual.update();
        });

        PubSub.default.pub("showToast", created > 0 ? "toast.success" : "toast.converter.error");
    }

    // The centre of a circle/arc edge: directly if the curve is circular, else from the basis curve a
    // trimmed (arc) curve wraps.
    private circleCenter(curve: ICurve): XYZ | undefined {
        if (CurveUtils.isCircle(curve)) return curve.center;
        const basis = (curve as ITrimmedCurve).basisCurve;
        if (basis && CurveUtils.isCircle(basis)) return basis.center;
        return undefined;
    }
}
