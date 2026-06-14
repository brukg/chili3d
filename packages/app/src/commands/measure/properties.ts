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
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "measure.properties",
    icon: "icon-measureSelect",
})
export class PropertiesMeasure extends MultistepCommand {
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
        const c = props.centerOfMass;
        PubSub.default.pub(
            "showToast",
            "toast.measure.properties:{0}{1}{2}{3}{4}",
            props.volume.toFixed(2),
            props.area.toFixed(2),
            c.x.toFixed(2),
            c.y.toFixed(2),
            c.z.toFixed(2),
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
