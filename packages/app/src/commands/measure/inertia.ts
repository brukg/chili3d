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

// Measure Moments of Inertia: report the inertia tensor of a solid about its centre of mass
// (Fusion's Properties → Moments of inertia). The kernel integrates r² over the volume with unit
// density, so the diagonal (Ixx, Iyy, Izz) and products (Ixy, Ixz, Iyz) are in mm⁵; multiply by a
// material density to get physical units. For a box a·b·c, Ixx = V·(b²+c²)/12 about the centre.
@command({
    key: "measure.inertia",
    icon: "icon-measureSelect",
})
export class InertiaMeasure extends MultistepCommand {
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
        const i = props.momentOfInertia;
        const p = props.productOfInertia;
        PubSub.default.pub(
            "showToast",
            "toast.measure.inertia:{0}{1}{2}{3}{4}{5}",
            i.x.toFixed(2),
            i.y.toFixed(2),
            i.z.toFixed(2),
            p.x.toFixed(2),
            p.y.toFixed(2),
            p.z.toFixed(2),
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
