// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IFace,
    type IShape,
    PointStep,
    PubSub,
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

    // Counterbore: a wider, shallow recess at the hole entry for a bolt head to sit flush. A radius
    // larger than the bore and a positive depth turn the plain hole into a counterbored one; the
    // defaults (0) leave a plain cylindrical hole, so existing behaviour is unchanged.
    @property("option.command.counterboreRadius")
    get counterboreRadius() {
        return this.getPrivateValue("counterboreRadius", 0);
    }
    set counterboreRadius(value: number) {
        this.setProperty("counterboreRadius", value);
    }

    @property("option.command.counterboreDepth")
    get counterboreDepth() {
        return this.getPrivateValue("counterboreDepth", 0);
    }
    set counterboreDepth(value: number) {
        this.setProperty("counterboreDepth", value);
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
            if (!holed.isOk) {
                // EditableShapeNode's constructor assigns the shape directly (bypassing the
                // setShape error path), so guard here to surface the failure and keep the
                // original solid instead of silently replacing it with an empty node.
                PubSub.default.pub("displayError", holed.error);
                return;
            }

            let result: IShape = holed.value;
            if (this.counterboreRadius > this.radius && this.counterboreDepth > 0) {
                // Cut a wider, shallow cylinder at the entry. Start it a hair above the surface
                // (along the outward normal) so the cut isn't coplanar with the face — coplanar
                // tool faces make the boolean unreliable.
                const eps = 0.01;
                const cbCenter = location.add(normal.multiply(eps));
                const cbCylinder = shapeFactory.cylinder(
                    direction,
                    cbCenter,
                    this.counterboreRadius,
                    this.counterboreDepth + eps,
                );
                if (cbCylinder.isOk) {
                    const cut = shapeFactory.booleanCut([result], [cbCylinder.value]);
                    if (cut.isOk) {
                        result = cut.value;
                    }
                }
            }

            const model = new EditableShapeNode({
                document: this.document,
                name: node.name,
                shape: result,
                materialId: node.materialId,
            });
            (node.parent ?? this.document.modelManager.rootNode).add(model);
            node.parent?.remove(node);
            this.document.visual.update();
        });
    }
}
