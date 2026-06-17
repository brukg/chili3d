// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IEdge,
    type IStep,
    Plane,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
    XYZ,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Cross Section: cut the selected solid with a plane through its centre (parallel to the active
// workplane) and build the filled section face — the cut surface, useful for section analysis and as a
// drawing section view. Unlike Section (intersection curves between two shapes), this caps the cut.
@command({
    key: "create.crossSection",
    icon: "icon-section",
})
export class CrossSection extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.solid, "prompt.select.solids")];
    }

    protected override executeMainTask(): void {
        const data = this.stepDatas[0].shapes[0];
        if (!data) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const shape = data.shape.transformedMul(data.transform);
        const box = shape.boundingBox();
        const center = new XYZ({
            x: (box.min.x + box.max.x) / 2,
            y: (box.min.y + box.max.y) / 2,
            z: (box.min.z + box.max.z) / 2,
        });
        const normal = this.application.activeView?.workplane.normal ?? XYZ.unitZ;
        const plane = new Plane({
            origin: center,
            normal,
            xvec: this.application.activeView!.workplane.xvec,
        });

        const edges = shape.section(plane).findSubShapes(ShapeTypes.edge) as IEdge[];
        if (edges.length === 0) {
            PubSub.default.pub("showToast", "toast.converter.error");
            return;
        }
        const wire = shapeFactory.wire(edges);
        const face = wire.isOk ? wire.value.toFace() : wire;
        if (!face.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", face.error);
            return;
        }
        Transaction.execute(this.document, "cross section", () => {
            const node = new EditableShapeNode({
                document: this.document,
                name: "Section",
                shape: face.value,
            });
            this.document.modelManager.addNode(node);
            this.document.visual.update();
        });
    }
}
