// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IShape,
    type ISolid,
    type IStep,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
} from "@chili3d/core";
import { PointNode } from "../../bodys";
import { MultistepCommand } from "../multistepCommand";

// Center of Mass: drop a parametric point at the centre of mass of a selected solid (Fusion's
// Inspect → Center of Mass). The picked shape is transformed to world space first, so the marker
// lands at the solid's true world-space centroid.
@command({
    key: "measure.centerOfMass",
    icon: "icon-measureSelect",
})
export class CenterOfMassMeasure extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.solid, "prompt.select.solids")];
    }

    protected override executeMainTask(): void {
        const shape = this.transformdFirstShape(this.stepDatas[0]);
        const solid = this.findSolid(shape);
        if (!solid) {
            PubSub.default.pub("showToast", "error.default:{0}", "selection is not a solid");
            return;
        }

        const props = solid.massProperties();
        const center = props.centerOfMass;
        Transaction.execute(this.document, "center of mass", () => {
            const node = this.stepDatas[0].shapes[0].owner.node;
            const point = new PointNode({ document: this.document, position: center });
            (node?.parent ?? this.document.modelManager.rootNode).add(point);
            this.document.visual.update();
        });
        PubSub.default.pub(
            "showToast",
            "toast.measure.properties:{0}{1}{2}{3}{4}",
            props.volume.toFixed(2),
            props.area.toFixed(2),
            center.x.toFixed(2),
            center.y.toFixed(2),
            center.z.toFixed(2),
        );
    }

    private findSolid(shape: IShape): ISolid | undefined {
        if (shape.shapeType === ShapeTypes.solid) {
            return shape as ISolid;
        }
        const solids = shape.findSubShapes(ShapeTypes.solid) as ISolid[];
        return solids[0];
    }
}
