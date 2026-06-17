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
import { computeArcFromPoints, filletCorner } from "./arcUtils";

// Sketch Fillet: round the corner between two straight edges that meet at a point with a tangent arc of
// the given radius. The two edges are trimmed to the tangent points and joined by the fillet arc.
@command({
    key: "create.sketchFillet",
    icon: "icon-circle",
})
export class SketchFillet extends MultistepCommand {
    @property("circle.radius")
    get radius() {
        return this.getPrivateValue("radius", 2);
    }
    set radius(value: number) {
        this.setProperty("radius", value);
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
            PubSub.default.pub("showToast", "error.default:{0}", "fillet needs two straight edges");
            return;
        }
        const corner = this.sharedCorner(ends1, ends2);
        if (!corner) {
            PubSub.default.pub("showToast", "error.default:{0}", "the edges do not share an endpoint");
            return;
        }
        const [C, far1] = corner.first;
        const far2 = corner.second;
        const fillet = filletCorner(C, far1, far2, this.radius);
        if (!fillet) {
            PubSub.default.pub("showToast", "error.default:{0}", "radius too large for this corner");
            return;
        }

        const arcParams = computeArcFromPoints(fillet.t1, fillet.mid, fillet.t2);
        const edges: IEdge[] = [];
        const line1 = shapeFactory.line(far1, fillet.t1);
        const line2 = shapeFactory.line(fillet.t2, far2);
        const arc = arcParams
            ? shapeFactory.arc(arcParams.normal, arcParams.center, arcParams.start, arcParams.angle)
            : undefined;
        for (const r of [line1, arc, line2]) if (r?.isOk) edges.push(r.value);

        const wire = shapeFactory.wire(edges);
        if (!wire.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", wire.error);
            return;
        }
        Transaction.execute(this.document, "sketch fillet", () => {
            const node = new EditableShapeNode({
                document: this.document,
                name: "Fillet",
                shape: wire.value,
            });
            this.document.modelManager.addNode(node);
            this.document.visual.update();
        });
    }

    // The two endpoints of a straight edge, or undefined if it isn't a single straight segment.
    private endpoints(edge: IEdge): [XYZ, XYZ] | undefined {
        const verts = edge.findSubShapes(ShapeTypes.vertex) as IVertex[];
        if (verts.length !== 2) return undefined;
        return [verts[0].point(), verts[1].point()];
    }

    // Find the endpoint the two edges share; return [corner, far-end-of-edge1] and the far end of edge2.
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
