// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EditableShapeNode,
    type IEdge,
    type IStep,
    type IVertex,
    PubSub,
    property,
    SelectShapeStep,
    ShapeTypes,
    Transaction,
    type XYZ,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";
import { chamferCorner } from "./arcUtils";

// Sketch Chamfer: bevel the corner between two straight edges that meet at a point, setting back the
// given distance along each edge and joining the setback points with a straight line.
@command({
    key: "create.sketchChamfer",
    icon: "icon-circle",
})
export class SketchChamfer extends MultistepCommand {
    @property("common.length")
    get distance() {
        return this.getPrivateValue("distance", 2);
    }
    set distance(value: number) {
        this.setProperty("distance", value);
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges"),
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", { keepSelection: true }),
        ];
    }

    protected override executeMainTask(): void {
        const a = this.stepDatas[0].shapes[0];
        const b = this.stepDatas[1].shapes[0];
        if (!a || !b) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const ends1 = this.endpoints(a.shape.transformedMul(a.transform) as IEdge);
        const ends2 = this.endpoints(b.shape.transformedMul(b.transform) as IEdge);
        if (!ends1 || !ends2) {
            PubSub.default.pub("showToast", "error.default:{0}", "chamfer needs two straight edges");
            return;
        }
        const corner = this.sharedCorner(ends1, ends2);
        if (!corner) {
            PubSub.default.pub("showToast", "error.default:{0}", "the edges do not share an endpoint");
            return;
        }
        const [C, far1] = corner.first;
        const far2 = corner.second;
        const chamfer = chamferCorner(C, far1, far2, this.distance);
        if (!chamfer) {
            PubSub.default.pub("showToast", "error.default:{0}", "setback too large for this corner");
            return;
        }

        const edges: IEdge[] = [];
        for (const r of [
            shapeFactory.line(far1, chamfer.c1),
            shapeFactory.line(chamfer.c1, chamfer.c2),
            shapeFactory.line(chamfer.c2, far2),
        ]) {
            if (r.isOk) edges.push(r.value);
        }
        const wire = shapeFactory.wire(edges);
        if (!wire.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", wire.error);
            return;
        }
        Transaction.execute(this.document, "sketch chamfer", () => {
            const node = new EditableShapeNode({
                document: this.document,
                name: "Chamfer",
                shape: wire.value,
            });
            this.document.modelManager.addNode(node);
            this.document.visual.update();
        });
    }

    private endpoints(edge: IEdge): [XYZ, XYZ] | undefined {
        const verts = edge.findSubShapes(ShapeTypes.vertex) as IVertex[];
        if (verts.length !== 2) return undefined;
        return [verts[0].point(), verts[1].point()];
    }

    private sharedCorner(e1: [XYZ, XYZ], e2: [XYZ, XYZ]) {
        const eq = (p: XYZ, q: XYZ) => p.distanceTo(q) < 1e-4;
        for (const i of [0, 1]) {
            for (const j of [0, 1]) {
                if (eq(e1[i], e2[j])) {
                    return { first: [e1[i], e1[1 - i]] as [XYZ, XYZ], second: e2[1 - j] };
                }
            }
        }
        return undefined;
    }
}
