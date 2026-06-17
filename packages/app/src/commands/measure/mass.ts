// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IShape,
    type ISolid,
    type IStep,
    PubSub,
    property,
    SelectShapeStep,
    ShapeTypes,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Measure Mass: report the mass of a solid from a physical-material density (Fusion's physical
// material → mass). Density is in kg/m³ (steel ≈ 7850, aluminium ≈ 2700, ABS ≈ 1050, water = 1000);
// the kernel volume is in mm³, so mass(g) = density(kg/m³) · volume(mm³) · 1e-6.
@command({
    key: "measure.mass",
    icon: "icon-measureSelect",
})
export class MassMeasure extends MultistepCommand {
    @property("measure.density")
    get density() {
        return this.getPrivateValue("density", 7850);
    }
    set density(value: number) {
        this.setProperty("density", value);
    }

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

        const volume = solid.massProperties().volume; // mm³
        const grams = (this.density * volume) / 1e6;
        PubSub.default.pub(
            "showToast",
            "toast.measure.mass:{0}{1}",
            grams.toFixed(3),
            (grams / 1000).toFixed(6),
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
