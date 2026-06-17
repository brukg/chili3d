// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CurveUtils,
    command,
    EditableShapeNode,
    type ICircle,
    type ICurve,
    type IEdge,
    type IStep,
    type ITrimmedCurve,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Construction Axis: build a reference line along the revolution axis of each selected circular edge
// (a circle or arc) — Fusion's "axis through cylinder/circle". The line runs through the centre along
// the circle's axis, spanning ±2·radius, and is a ready-made axis for Revolve or circular patterns.
@command({
    key: "create.axis",
    icon: "icon-line",
})
export class ConstructionAxis extends MultistepCommand {
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
        Transaction.execute(this.document, "construction axis", () => {
            for (const data of shapes) {
                const edge = data.shape.transformedMul(data.transform) as IEdge;
                const circle = this.asCircle(edge.curve);
                if (!circle) continue;
                const half = circle.axis.normalize()!.multiply(circle.radius * 2);
                const line = shapeFactory.line(circle.center.sub(half), circle.center.add(half));
                if (!line.isOk) continue;
                const node = new EditableShapeNode({
                    document: this.document,
                    name: "Axis",
                    shape: line.value,
                });
                (data.owner.node?.parent ?? this.document.modelManager.rootNode).add(node);
                created++;
            }
            this.document.visual.update();
        });

        PubSub.default.pub("showToast", created > 0 ? "toast.success" : "toast.converter.error");
    }

    // A circle edge directly, or the circular basis curve an arc (trimmed curve) wraps.
    private asCircle(curve: ICurve): ICircle | undefined {
        if (CurveUtils.isCircle(curve)) return curve;
        const basis = (curve as ITrimmedCurve).basisCurve;
        if (basis && CurveUtils.isCircle(basis)) return basis;
        return undefined;
    }
}
