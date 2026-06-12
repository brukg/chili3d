// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IEdge,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "modify.fillSurface",
    icon: "icon-fillet",
})
export class FillSurfaceCommand extends MultistepCommand {
    protected override executeMainTask() {
        Transaction.execute(this.document, `execute ${Object.getPrototypeOf(this).data.name}`, () => {
            const edges = this.stepDatas[0].shapes.map((x) => x.shape.transformedMul(x.transform) as IEdge);
            const filled = shapeFactory.fillSurface(edges);
            if (!filled.isOk) {
                PubSub.default.pub("displayError", filled.error);
                return;
            }

            const node = new EditableShapeNode({
                document: this.document,
                name: "Surface",
                shape: filled,
            });
            this.document.modelManager.addNode(node);
            this.document.visual.update();
        });
    }

    protected override getSteps() {
        return [
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", {
                multiple: true,
            }),
        ];
    }
}
