// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IFace,
    type IShape,
    PointStep,
    property,
    SelectShapeStep,
    type ShapeNode,
    ShapeTypes,
    Transaction,
    VisualStates,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "modify.hole",
    icon: "icon-hole",
})
export class HoleCommand extends MultistepCommand {
    @property("circle.radius")
    get radius() {
        return this.getPrivateValue("radius", 3);
    }
    set radius(value: number) {
        this.setProperty("radius", value);
    }

    @property("common.length")
    get depth() {
        return this.getPrivateValue("depth", 10);
    }
    set depth(value: number) {
        this.setProperty("depth", value);
    }

    protected override getSteps() {
        return [
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces", {
                selectedState: VisualStates.faceTransparent,
            }),
            new PointStep("prompt.pickHoleLocation"),
        ];
    }

    protected override executeMainTask() {
        Transaction.execute(this.document, `execute ${Object.getPrototypeOf(this).data.name}`, () => {
            const selected = this.stepDatas[0].shapes[0];
            const node = selected.owner.node as ShapeNode;

            // Work in world space: transform the local solid + face by the node transform.
            const worldSolid: IShape = node.shape.value.transformedMul(node.transform);
            const worldFace = selected.shape.transformedMul(node.transform) as IFace;
            const [, normal] = worldFace.normal(0.5, 0.5);

            const location = this.stepDatas[1].point!;
            const direction = normal.multiply(-1); // drill inward, opposite the outward face normal

            const holed = shapeFactory.makeHole(worldSolid, location, direction, this.radius, this.depth);
            const model = new EditableShapeNode({
                document: this.document,
                name: node.name,
                shape: holed,
                materialId: node.materialId,
            });
            (node.parent ?? this.document.modelManager.rootNode).add(model);
            node.parent?.remove(node);
            this.document.visual.update();
        });
    }
}
