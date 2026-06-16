// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    AsyncController,
    command,
    Dimensions,
    I18n,
    type IApplication,
    type ICommand,
    type ICurve,
    type IEdge,
    type IFace,
    type IStep,
    type IVertex,
    Observable,
    Plane,
    PointOnCurveStep,
    PointStep,
    PropertyUtils,
    PubSub,
    property,
    SelectableItems,
    SelectShapeStep,
    ShapeTypes,
    XYZ,
} from "@chili3d/core";
import { div, RadioGroup } from "@chili3d/element";
import { MultistepCommand } from "./multistepCommand";

// A sensible plane X axis for a given normal: the world-Z×normal direction, falling back to world-X
// when the normal is itself vertical. Shared by every construction-plane command below.
function planeXVec(normal: XYZ): XYZ {
    if (!normal.isParallelTo(XYZ.unitZ)) {
        return XYZ.unitZ.cross(normal).normalize() ?? XYZ.unitX;
    }
    return XYZ.unitX;
}

// Direction of an edge, taken from its two endpoint vertices.
function edgeDirection(edge: IEdge): XYZ | undefined {
    const verts = edge.findSubShapes(ShapeTypes.vertex) as IVertex[];
    if (verts.length < 2) return undefined;
    return verts[1].point().sub(verts[0].point()).normalize();
}

export class WorkingPlaneViewModel extends Observable {
    @property("dialog.title.selectWorkingPlane")
    planes: SelectableItems<string> = new SelectableItems(["XOY", "YOZ", "ZOX"], "radio", ["XOY"]);
}

@command({
    key: "workingPlane.set",
    icon: "icon-setWorkingPlane",
})
export class SetWorkplane implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const view = application.activeView;
        if (!view) return;

        const vm = new WorkingPlaneViewModel();
        PubSub.default.pub("showDialog", "dialog.title.selectWorkingPlane", this.ui(vm), () => {
            const planes = [Plane.XY, Plane.YZ, Plane.ZX];
            view.workplane = planes[vm.planes.selectedIndexes[0]];
        });
    }

    private ui(vm: WorkingPlaneViewModel) {
        return div(
            ...PropertyUtils.getProperties(vm).map((x) => {
                const value = (vm as any)[x.name];
                if (value instanceof SelectableItems) {
                    return new RadioGroup(I18n.translate(x.display), value);
                }
                return "";
            }),
        );
    }
}

@command({
    key: "workingPlane.alignToPlane",
    icon: "icon-alignWorkingPlane",
})
export class AlignToPlane implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const view = application.activeView;
        if (!view) return;
        view.document.selection.clearSelection();
        const controller = new AsyncController();
        const data = await new SelectShapeStep(ShapeTypes.face, "prompt.select.faces").execute(
            view.document,
            controller,
        );
        controller.dispose();
        if (!data || data.shapes.length === 0) return;
        view.document.visual.highlighter.clear();
        const face = data.shapes[0].shape.transformedMul(data.shapes[0].transform) as IFace;
        const [point, normal] = face.normal(0, 0);
        face.dispose();
        let xvec = XYZ.unitX;
        if (!normal.isParallelTo(XYZ.unitZ)) {
            xvec = XYZ.unitZ.cross(normal).normalize()!;
        }
        view.workplane = new Plane({ origin: point, normal, xvec });
    }
}

// Define the working plane by picking three points: the first is the origin, the first→second
// direction is the X axis, and the plane normal is (p2-p1) × (p3-p1). A classic construction-plane
// tool for sketching on an arbitrary datum.
@command({
    key: "workingPlane.from3Points",
    icon: "icon-setWorkingPlane",
})
export class WorkingPlaneFrom3Points extends MultistepCommand {
    protected override executeMainTask() {
        const view = this.application.activeView;
        if (!view) return;
        const p1 = this.stepDatas[0].point!;
        const p2 = this.stepDatas[1].point!;
        const p3 = this.stepDatas[2].point!;
        const xvec = p2.sub(p1).normalize();
        const normal = p2.sub(p1).cross(p3.sub(p1)).normalize();
        if (!xvec || !normal) {
            PubSub.default.pub("showToast", "toast.converter.error");
            return;
        }
        view.workplane = new Plane({ origin: p1, normal, xvec });
    }

    protected override getSteps(): IStep[] {
        return [
            new PointStep("prompt.pickFistPoint", undefined, true),
            new PointStep("prompt.pickNextPoint", undefined, true),
            new PointStep("prompt.pickNextPoint", undefined, true),
        ];
    }
}

@command({
    key: "workingPlane.fromSection",
    icon: "icon-fromSection",
})
export class FromSection extends MultistepCommand {
    protected override executeMainTask() {
        const curve = this.transformedCurve();
        const point = this.stepDatas[1].point!;

        const parameter = curve.parameter(point, 1e-3);
        if (parameter === undefined) return;
        const direction = curve.d1(parameter).vec.normalize()!;
        const xvec: XYZ = this.findXVec(direction);
        const plane = new Plane({ origin: point, normal: direction, xvec });
        const view = this.application.activeView;
        if (!view) return;
        view.workplane = plane;
    }

    private findXVec(direction: XYZ) {
        let xvec: XYZ;
        if (direction.isEqualTo(XYZ.unitZ)) {
            xvec = XYZ.unitX;
        } else if (direction.isEqualTo(new XYZ({ x: 0, y: 0, z: -1 }))) {
            xvec = XYZ.unitY;
        } else {
            xvec = direction.cross(XYZ.unitZ).normalize()!;
        }
        return xvec;
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges"),
            new PointOnCurveStep("prompt.pickFistPoint", this.handlePointData, true),
        ];
    }

    private transformedCurve() {
        const shape = this.stepDatas[0].shapes[0].shape as IEdge;
        const matrix = shape.matrix.multiply(this.stepDatas[0].shapes[0].transform);
        const curve = shape.curve.transformed(matrix) as ICurve;
        this.disposeStack.add(curve);
        return curve;
    }

    private readonly handlePointData = () => {
        const curve = this.transformedCurve();
        return {
            curve,
            dimension: Dimensions.D1,
            preview: (point: XYZ | undefined) => {
                if (!point) return [];
                const project = curve.project(point).at(0);
                return [this.meshPoint(project ?? point)];
            },
        };
    };
}

// Offset construction plane: pick a face, the working plane becomes that face's plane translated
// along its normal by `distance` — the standard way to sketch parallel to an existing face.
@command({
    key: "workingPlane.offset",
    icon: "icon-setWorkingPlane",
})
export class OffsetPlane extends MultistepCommand {
    @property("option.command.distance")
    get distance() {
        return this.getPrivateValue("distance", 10);
    }
    set distance(value: number) {
        this.setProperty("distance", value);
    }

    protected override executeMainTask() {
        const view = this.application.activeView;
        if (!view) return;
        const data = this.stepDatas[0].shapes[0];
        const face = data.shape.transformedMul(data.transform) as IFace;
        const [point, normal] = face.normal(0, 0);
        face.dispose();
        const origin = point.add(normal.multiply(this.distance));
        view.workplane = new Plane({ origin, normal, xvec: planeXVec(normal) });
    }

    protected override getSteps(): IStep[] {
        return [new SelectShapeStep(ShapeTypes.face, "prompt.select.faces")];
    }
}

// Angled construction plane: pick a face and a straight edge (the hinge axis), then rotate the
// face's plane about that edge by `angle` degrees — Fusion's "plane at angle".
@command({
    key: "workingPlane.atAngle",
    icon: "icon-setWorkingPlane",
})
export class PlaneAtAngle extends MultistepCommand {
    @property("common.angle")
    get angle() {
        return this.getPrivateValue("angle", 45);
    }
    set angle(value: number) {
        this.setProperty("angle", value);
    }

    protected override executeMainTask() {
        const view = this.application.activeView;
        if (!view) return;
        const faceData = this.stepDatas[0].shapes[0];
        const face = faceData.shape.transformedMul(faceData.transform) as IFace;
        const [point, normal] = face.normal(0, 0);
        face.dispose();
        const edgeData = this.stepDatas[1].shapes[0];
        const edge = edgeData.shape.transformedMul(edgeData.transform) as IEdge;
        const axis = edgeDirection(edge);
        edge.dispose();
        if (!axis) {
            PubSub.default.pub("showToast", "toast.converter.error");
            return;
        }
        const radians = (this.angle * Math.PI) / 180;
        const rotatedNormal = normal.rotate(axis, radians);
        const rotatedX = planeXVec(normal).rotate(axis, radians);
        if (!rotatedNormal || !rotatedX) {
            PubSub.default.pub("showToast", "toast.converter.error");
            return;
        }
        view.workplane = new Plane({ origin: point, normal: rotatedNormal, xvec: rotatedX });
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces"),
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges"),
        ];
    }
}

// Mid construction plane: pick two faces, the working plane sits halfway between them with the
// first face's orientation — the usual way to mirror or sketch on a part's symmetry plane.
@command({
    key: "workingPlane.midPlane",
    icon: "icon-setWorkingPlane",
})
export class MidPlane extends MultistepCommand {
    protected override executeMainTask() {
        const view = this.application.activeView;
        if (!view) return;
        const data1 = this.stepDatas[0].shapes[0];
        const data2 = this.stepDatas[1].shapes[0];
        const face1 = data1.shape.transformedMul(data1.transform) as IFace;
        const face2 = data2.shape.transformedMul(data2.transform) as IFace;
        const [p1, normal] = face1.normal(0, 0);
        const [p2] = face2.normal(0, 0);
        face1.dispose();
        face2.dispose();
        const origin = p1.add(p2).multiply(0.5);
        view.workplane = new Plane({ origin, normal, xvec: planeXVec(normal) });
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces"),
            new SelectShapeStep(ShapeTypes.face, "prompt.select.faces"),
        ];
    }
}
