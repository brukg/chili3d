// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    AsyncController,
    command,
    Dimensions,
    EditableShapeNode,
    type GeometryNode,
    I18n,
    type IStep,
    MeshDataUtils,
    type PointSnapData,
    PointStep,
    Precision,
    type ShapeMeshData,
    type SnapResult,
    VisualConfig,
    type XYZ,
} from "@chili3d/core";
import { CreateCommand } from "../createCommand";

// Fit-point spline: a B-spline curve passing through every picked point (kernel GeomAPI_Interpolate),
// unlike Bezier whose points are control points. Click the first point again to close the loop into a
// smooth periodic spline. This is Fusion's "fit point spline".
@command({
    key: "create.spline",
    icon: "icon-bezier",
})
export class SplineCommand extends CreateCommand {
    protected override geometryNode(): GeometryNode {
        const points = this.stepDatas.map((x) => x.point!);
        // If the last point closes back onto the first, drop the duplicate and build a periodic spline.
        const periodic = points.length > 2 && points[0].distanceTo(points.at(-1)!) <= Precision.Distance;
        const fit = periodic ? points.slice(0, -1) : points;
        const spline = shapeFactory.interpolate(fit, periodic);
        return new EditableShapeNode({
            document: this.document,
            name: I18n.translate("command.create.spline"),
            shape: spline.value,
        });
    }

    protected override async executeSteps() {
        const steps = this.getSteps();
        let firstStep = true;
        while (true) {
            const step = firstStep ? steps[0] : steps[1];
            if (firstStep) firstStep = false;
            this.controller = new AsyncController();
            const data = await step.execute(this.document, this.controller);
            if (data === undefined) {
                return this.controller.result?.status === "success";
            }
            this.stepDatas.push(data);
            if (this.isClose(data)) {
                return true;
            }
        }
    }

    private isClose(data: SnapResult) {
        return (
            this.stepDatas.length > 1 &&
            this.stepDatas[0].point!.distanceTo(data.point!) <= Precision.Distance
        );
    }

    protected override getSteps(): IStep[] {
        const firstStep = new PointStep("prompt.pickFistPoint");
        const secondStep = new PointStep("prompt.pickNextPoint", this.getNextData);
        return [firstStep, secondStep];
    }

    private readonly getNextData = (): PointSnapData => {
        return {
            refPoint: () => this.stepDatas.at(-1)!.point!,
            dimension: Dimensions.D1D2D3,
            validator: this.validator,
            preview: this.preview,
            featurePoints: [
                {
                    point: this.stepDatas.at(0)!.point!,
                    prompt: I18n.translate("prompt.polygon.close"),
                    when: () => this.stepDatas.length > 2,
                },
            ],
        };
    };

    private readonly preview = (point: XYZ | undefined): ShapeMeshData[] => {
        const ps: ShapeMeshData[] = this.stepDatas.map((data) => this.meshPoint(data.point!));
        const points = this.stepDatas.map((data) => data.point) as XYZ[];
        if (point) {
            points.push(point);
        }
        if (points.length > 2) {
            ps.push(this.meshCreatedShape("interpolate", points, false));
        } else if (points.length > 1) {
            ps.push(...this.previewLines(points));
        }
        return ps;
    };

    private readonly previewLines = (points: XYZ[]): ShapeMeshData[] => {
        const res: ShapeMeshData[] = [];
        for (let i = 1; i < points.length; i++) {
            res.push(this.meshHandle(points[i - 1], points[i]));
        }
        return res;
    };

    protected meshHandle(start: XYZ, end: XYZ) {
        return MeshDataUtils.createEdgeMesh(start, end, VisualConfig.temporaryEdgeColor, "dash");
    }

    private readonly validator = (point: XYZ): boolean => {
        for (const data of this.stepDatas) {
            if (point.distanceTo(data.point!) < 0.001) {
                return false;
            }
        }
        return true;
    };
}
