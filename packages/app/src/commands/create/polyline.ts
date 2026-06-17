// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    AsyncController,
    command,
    Dimensions,
    EditableShapeNode,
    type GeometryNode,
    I18n,
    type IEdge,
    type IStep,
    type PointSnapData,
    PointStep,
    Precision,
    type ShapeMeshData,
    type SnapResult,
    type XYZ,
} from "@chili3d/core";
import { CreateCommand } from "../createCommand";

// Polyline: chain connected straight segments by clicking a sequence of points (Fusion's Line tool).
// Click the first point again to close the loop. The result is a single wire of line edges.
@command({
    key: "create.polyline",
    icon: "icon-line",
})
export class Polyline extends CreateCommand {
    protected override geometryNode(): GeometryNode {
        const points = this.stepDatas.map((x) => x.point!);
        const closed = points.length > 2 && points[0].distanceTo(points.at(-1)!) <= Precision.Distance;
        const used = closed ? points.slice(0, -1) : points;
        const edges: IEdge[] = [];
        const n = used.length;
        const segments = closed ? n : n - 1;
        for (let i = 0; i < segments; i++) {
            const seg = shapeFactory.line(used[i], used[(i + 1) % n]);
            if (seg.isOk) edges.push(seg.value);
        }
        const wire = shapeFactory.wire(edges);
        return new EditableShapeNode({
            document: this.document,
            name: I18n.translate("command.create.polyline"),
            shape: wire.isOk ? wire.value : edges[0],
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
        return [
            new PointStep("prompt.pickFistPoint"),
            new PointStep("prompt.pickNextPoint", this.getNextData),
        ];
    }

    private readonly getNextData = (): PointSnapData => ({
        refPoint: () => this.stepDatas.at(-1)!.point!,
        dimension: Dimensions.D1D2D3,
        validator: (point: XYZ) => point.distanceTo(this.stepDatas.at(-1)!.point!) > Precision.Distance,
        preview: this.preview,
        featurePoints: [
            {
                point: this.stepDatas.at(0)!.point!,
                prompt: I18n.translate("prompt.polygon.close"),
                when: () => this.stepDatas.length > 2,
            },
        ],
    });

    private readonly preview = (point: XYZ | undefined): ShapeMeshData[] => {
        const points = this.stepDatas.map((data) => data.point!) as XYZ[];
        const meshes: ShapeMeshData[] = points.map((p) => this.meshPoint(p));
        const all = point ? [...points, point] : points;
        for (let i = 1; i < all.length; i++) meshes.push(this.meshLine(all[i - 1], all[i]));
        return meshes;
    };
}
