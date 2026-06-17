// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IShape, type IStep, PubSub, SelectShapeStep, ShapeTypes } from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Check Geometry (Fusion's Inspect → Check Geometry): run BRepCheck_Analyzer over a body and report
// whether it is topologically/geometrically valid. When invalid, count the offending faces so the user
// knows the extent of the damage (self-intersections, broken wires, bad orientations, …).
@command({
    key: "measure.checkGeometry",
    icon: "icon-measureSelect",
})
export class CheckGeometryCommand extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.solid, "prompt.select.solids")];
    }

    protected override executeMainTask(): void {
        const shape = this.transformdFirstShape(this.stepDatas[0]);
        if (!shape) {
            PubSub.default.pub("showToast", "error.default:{0}", "no shape selected");
            return;
        }

        if (shape.isValid()) {
            PubSub.default.pub("showToast", "toast.measure.geometryValid");
            return;
        }

        const faces = shape.findSubShapes(ShapeTypes.face) as IShape[];
        const badFaces = faces.filter((f) => !f.isValid()).length;
        PubSub.default.pub("showToast", "toast.measure.geometryInvalid:{0}", badFaces.toString());
    }
}
