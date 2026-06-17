// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IEdge,
    type IStep,
    type IWire,
    PubSub,
    SelectShapeStep,
    type ShapeType,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Ruled Surface: a straight-line (ruled) surface stretched between two selected edges or wires —
// Fusion's "Ruled" surface. A loft with isRuled = true and isSolid = false: the surface is the union
// of straight segments joining corresponding points of the two rails.
@command({
    key: "create.ruledSurface",
    icon: "icon-loft",
})
export class RuledSurface extends MultistepCommand {
    protected override getSteps(): IStep[] {
        const filter = (ShapeTypes.edge | ShapeTypes.wire) as ShapeType;
        return [
            new SelectShapeStep(filter, "prompt.select.edges"),
            new SelectShapeStep(filter, "prompt.select.edges", { keepSelection: true }),
        ];
    }

    protected override executeMainTask(): void {
        const first = this.stepDatas[0].shapes[0];
        const second = this.stepDatas[1].shapes[0];
        if (!first || !second) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const rail1 = first.shape.transformedMul(first.transform) as IEdge | IWire;
        const rail2 = second.shape.transformedMul(second.transform) as IEdge | IWire;

        const surface = shapeFactory.loft([rail1, rail2], false, true, "c0");
        if (!surface.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", surface.error);
            return;
        }
        Transaction.execute(this.document, "ruled surface", () => {
            const node = new EditableShapeNode({
                document: this.document,
                name: "Ruled Surface",
                shape: surface.value,
            });
            this.document.modelManager.addNode(node);
            this.document.visual.update();
        });
    }
}
