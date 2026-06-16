// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type GeometryNode, type SketchConstraint } from "@chili3d/core";
import { SketchNode } from "../../bodys";
import { RectCommandBase } from "./rect";

// Sketch Rectangle: a two-corner rectangle that is created as a fully-constrained SketchNode (four
// corners with horizontal/vertical edges plus signed width/height dimensions) rather than a static
// face — so it stays editable and parameter-drivable like a real sketch profile.
@command({
    key: "create.sketchRect",
    icon: "icon-rect",
})
export class SketchRect extends RectCommandBase {
    protected override geometryNode(): GeometryNode {
        const { plane, dx, dy } = this.rectDataFromTwoSteps();
        // Corners are in plane-local coordinates (the origin is the first picked corner).
        const points = [
            { x: 0, y: 0 },
            { x: dx, y: 0 },
            { x: dx, y: dy },
            { x: 0, y: dy },
        ];
        const constraints: SketchConstraint[] = [
            { type: "fixed", point: 0, x: 0, y: 0 },
            { type: "horizontal", a: 0, b: 1 },
            { type: "horizontal", a: 3, b: 2 },
            { type: "vertical", a: 0, b: 3 },
            { type: "vertical", a: 1, b: 2 },
            { type: "distanceX", a: 0, b: 1, dx },
            { type: "distanceY", a: 0, b: 3, dy },
        ];
        return new SketchNode({ document: this.document, plane, points, constraints });
    }
}
