// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    AsyncController,
    command,
    Dimensions,
    EdgeMeshDataBuilder,
    type GeometryNode,
    I18n,
    type IStep,
    type PointSnapData,
    PointStep,
    Precision,
    property,
    type ShapeMeshData,
    type SketchConstraint,
    type SnapResult,
    type XYZ,
} from "@chili3d/core";
import { SketchNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

// A segment within this fraction of its length off an axis is auto-snapped to it (~10°).
const AXIS_TOLERANCE = 0.17;

/**
 * Draw a sketch profile on the working plane (click points, close on the first point). The picked
 * points become a parametric {@link SketchNode}: an unconstrained but solvable profile that can be
 * dimensioned (via constraint commands / the property panel) and extruded/revolved referentially.
 */
@command({
    key: "create.sketch",
    icon: "icon-toPoly",
})
export class CreateSketch extends CreateCommand {
    @property("common.confirm")
    readonly confirm = () => {
        this.controller?.success();
    };

    protected override geometryNode(): GeometryNode {
        // Map each world pick to 2D plane coordinates (u along xvec, v along yvec).
        const plane = this.stepDatas[0].view.workplane;
        const points = this.stepDatas.map((step) => {
            const d = step.point!.sub(plane.origin);
            return { x: d.dot(plane.xvec), y: d.dot(plane.yvec) };
        });
        return new SketchNode({
            document: this.document,
            plane,
            points,
            constraints: this.autoConstraints(points),
        });
    }

    // Auto-constrain: pin the first point and snap each near-axis segment to horizontal/vertical, so
    // a roughly-drawn profile solves to clean axis-aligned geometry — the heart of a sketcher.
    private autoConstraints(points: { x: number; y: number }[]): SketchConstraint[] {
        const constraints: SketchConstraint[] = [{ type: "fixed", point: 0, x: points[0].x, y: points[0].y }];
        const n = points.length;
        for (let i = 0; i < n; i++) {
            const a = points[i];
            const b = points[(i + 1) % n];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy);
            if (len < 1e-6) continue;
            if (Math.abs(dy) / len < AXIS_TOLERANCE) {
                constraints.push({ type: "horizontal", a: i, b: (i + 1) % n });
            } else if (Math.abs(dx) / len < AXIS_TOLERANCE) {
                constraints.push({ type: "vertical", a: i, b: (i + 1) % n });
            }
        }
        return constraints;
    }

    protected override async executeSteps(): Promise<boolean> {
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
        const ps = this.stepDatas.map((data) => this.meshPoint(data.point!));
        const edges = new EdgeMeshDataBuilder();
        this.stepDatas.forEach((data) => edges.addPosition(data.point!.x, data.point!.y, data.point!.z));
        if (point) {
            edges.addPosition(point.x, point.y, point.z);
        }
        return [...ps, edges.build()];
    };

    private readonly validator = (point: XYZ): boolean => {
        for (const data of this.stepDatas) {
            if (point.distanceTo(data.point!) < 0.001) {
                return false;
            }
        }
        return true;
    };
}
