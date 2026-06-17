// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    Dimensions,
    EditableShapeNode,
    type IEdge,
    type IStep,
    type PointSnapData,
    PointStep,
    Precision,
    PubSub,
    property,
    type Result,
    Transaction,
    type XYZ,
} from "@chili3d/core";
import { MultistepCommand } from "../multistepCommand";
import { computeArcFromPoints } from "./arcUtils";

// Build a curved (arc) slot of half-width r around the centre arc through S→M→E: an outer arc (radius
// R+r), a semicircular end cap, an inner arc (radius R−r) and a start cap. Pure + probe-verified
// (area = 2·R·r·θ + π·r²). Returns the four edges, or undefined if the arc is degenerate.
export function curvedSlotEdges(S: XYZ, M: XYZ, E: XYZ, r: number): IEdge[] | undefined {
    const p = computeArcFromPoints(S, M, E);
    if (!p) return undefined;
    const C = p.center;
    const normal = p.normal;
    const R = S.sub(C).length();
    if (R <= r) return undefined;
    const uS = S.sub(C).normalize()!;
    const uE = E.sub(C).normalize()!;
    const tanS = normal.cross(uS);
    const tanE = normal.cross(uE);
    const outerS = C.add(uS.multiply(R + r));
    const outerE = C.add(uE.multiply(R + r));
    const innerS = C.add(uS.multiply(R - r));
    const innerE = C.add(uE.multiply(R - r));

    const capE = computeArcFromPoints(outerE, E.add(tanE.multiply(r)), innerE);
    const capS = computeArcFromPoints(innerS, S.sub(tanS.multiply(r)), outerS);
    if (!capE || !capS) return undefined;

    const segs: Result<IEdge>[] = [
        shapeFactory.arc(normal, C, outerS, p.angle), // outer arc R+r
        shapeFactory.arc(capE.normal, capE.center, capE.start, capE.angle), // end cap
        shapeFactory.arc(normal, C, innerE, -p.angle), // inner arc R−r, reversed
        shapeFactory.arc(capS.normal, capS.center, capS.start, capS.angle), // start cap
    ];
    const edges: IEdge[] = [];
    for (const s of segs) if (s.isOk) edges.push(s.value);
    return edges.length === 4 ? edges : undefined;
}

// Sketch Arc Slot: a curved slot. Pick three points defining the slot's centre arc (start, a point on
// it, end); the width is the editable radius — Fusion's 3-point arc slot.
@command({
    key: "create.sketchArcSlot",
    icon: "icon-rect",
})
export class SketchArcSlot extends MultistepCommand {
    @property("circle.radius")
    get radius() {
        return this.getPrivateValue("radius", 3);
    }
    set radius(value: number) {
        this.setProperty("radius", value);
    }

    protected override getSteps(): IStep[] {
        return [
            new PointStep("prompt.pickFistPoint"),
            new PointStep("prompt.pickNextPoint", this.pointData),
            new PointStep("prompt.pickNextPoint", this.pointData),
        ];
    }

    private readonly pointData = (): PointSnapData => ({
        refPoint: () => this.stepDatas.at(-1)!.point!,
        dimension: Dimensions.D1D2D3,
        validator: (p: XYZ) => this.stepDatas.every((d) => d.point!.distanceTo(p) > Precision.Distance),
        preview: (p: XYZ | undefined) => {
            const pts = this.stepDatas.map((d) => this.meshPoint(d.point!));
            return p ? [...pts, this.meshPoint(p)] : pts;
        },
    });

    protected override executeMainTask(): void {
        const [s, m, e] = this.stepDatas.map((d) => d.point!);
        const edges = curvedSlotEdges(s, m, e, this.radius);
        if (!edges) {
            PubSub.default.pub(
                "showToast",
                "error.default:{0}",
                "cannot build an arc slot from these points",
            );
            return;
        }
        const wire = shapeFactory.wire(edges);
        const face = wire.isOk ? wire.value.toFace() : wire;
        if (!face.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", face.error);
            return;
        }
        Transaction.execute(this.document, "arc slot", () => {
            const node = new EditableShapeNode({
                document: this.document,
                name: "Arc Slot",
                shape: face.value,
            });
            this.document.modelManager.addNode(node);
            this.document.visual.update();
        });
    }
}
