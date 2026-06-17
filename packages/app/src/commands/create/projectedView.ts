// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IEdge,
    type IStep,
    PubSub,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
    XYZ,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";

// Projected View: flatten the selected solid(s) to a 2D outline along the current view direction using
// hidden-line removal (kernel HLR) — the foundation of a drawing view / "project to sketch". The
// result is a compound of the visible projected edges, ready to dimension or export to DXF.
@command({
    key: "create.projectedView",
    icon: "icon-line",
})
export class ProjectedView extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.solid, "prompt.select.solids", { multiple: true })];
    }

    protected override executeMainTask(): void {
        const view = this.application.activeView;
        if (!view) return;

        const direction = view.direction().normalize() ?? XYZ.unitZ;
        // Right vector of the view = up × direction; falls back to a perpendicular if degenerate.
        const xDir = view.up().cross(direction).normalize() ?? perpendicular(direction);

        const edges: IEdge[] = [];
        for (const data of this.stepDatas[0].shapes) {
            const shape = data.shape.transformedMul(data.transform);
            const projected = shape.hlr(XYZ.zero, direction, xDir);
            edges.push(...(projected.findSubShapes(ShapeTypes.edge) as IEdge[]));
        }

        if (edges.length === 0) {
            PubSub.default.pub("showToast", "toast.converter.error");
            return;
        }
        const compound = shapeFactory.combine(edges);
        if (!compound.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", compound.error);
            return;
        }
        Transaction.execute(this.document, "projected view", () => {
            const node = new EditableShapeNode({
                document: this.document,
                name: "View",
                shape: compound.value,
            });
            this.document.modelManager.addNode(node);
            this.document.visual.update();
        });
    }
}

// Any unit vector perpendicular to v (used when the view up and direction are parallel).
function perpendicular(v: XYZ): XYZ {
    const ref = Math.abs(v.z) < 0.9 ? XYZ.unitZ : XYZ.unitX;
    return ref.cross(v).normalize() ?? XYZ.unitX;
}
