// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    ParameterShapeNode,
    type Plane,
    type Point2d,
    Result,
    type SketchConstraint,
    serializable,
    serialize,
    solveConstraints,
    toConstraint,
} from "@chili3d/core";

export interface SketchNodeOptions {
    document: IDocument;
    plane: Plane;
    points: Point2d[];
    constraints: SketchConstraint[];
}

@serializable()
export class SketchNode extends ParameterShapeNode {
    override display(): I18nKeys {
        return "body.sketch";
    }

    @serialize()
    get plane(): Plane {
        return this.getPrivateValue("plane");
    }

    @serialize()
    get points(): Point2d[] {
        return this.getPrivateValue("points");
    }
    set points(value: Point2d[]) {
        this.setPropertyEmitShapeChanged("points", value);
    }

    @serialize()
    get constraints(): SketchConstraint[] {
        return this.getPrivateValue("constraints");
    }
    set constraints(value: SketchConstraint[]) {
        this.setPropertyEmitShapeChanged("constraints", value);
    }

    constructor(options: SketchNodeOptions) {
        super(options);
        this.setPrivateValue("plane", options.plane);
        this.setPrivateValue("points", options.points);
        this.setPrivateValue("constraints", options.constraints);
    }

    generateShape(): Result<IShape> {
        const solved = solveConstraints(this.points, this.constraints.map(toConstraint));
        if (!solved.converged) {
            return Result.err("Sketch is over-constrained or did not converge");
        }

        const plane = this.plane;
        const points3d = solved.points.map((p) =>
            plane.origin.add(plane.xvec.multiply(p.x)).add(plane.yvec.multiply(p.y)),
        );
        // Close the loop — `polygon` does not auto-close, and an open profile yields a wrong face.
        if (points3d.length > 2) points3d.push(points3d[0]);
        return shapeFactory.polygon(points3d);
    }
}
