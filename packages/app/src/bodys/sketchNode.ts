// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    analyzeConstraints,
    type I18nKeys,
    type IDocument,
    type IShape,
    ParameterShapeNode,
    ParameterStore,
    type Plane,
    type Point2d,
    PubSub,
    property,
    Result,
    type SketchConstraint,
    serializable,
    serialize,
    solveConstraints,
    toConstraint,
    type XYZ,
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

    /** Read-only solver state — "Fully constrained", or the remaining degrees of freedom / redundant
     * constraints. The sketcher feedback that tells you whether the profile is fully defined. */
    @property("sketch.status")
    get constraintStatus(): string {
        return SketchNode.describeStatus(this.points, this.constraints, this.document);
    }

    static describeStatus(points: Point2d[], constraints: SketchConstraint[], document: IDocument): string {
        const scope = new ParameterStore(document).resolve();
        const parameters = scope.isOk ? scope.value : {};
        const analysis = analyzeConstraints(
            points,
            constraints.map((c) => toConstraint(c, parameters)),
        );
        if (analysis.status === "fully-constrained") return "Fully constrained";
        if (analysis.status === "over-constrained") {
            return `Over-constrained (${analysis.redundant} redundant)`;
        }
        return `Under-constrained (${analysis.degreesOfFreedom} DoF)`;
    }

    constructor(options: SketchNodeOptions) {
        super(options);
        this.setPrivateValue("plane", options.plane);
        this.setPrivateValue("points", options.points);
        this.setPrivateValue("constraints", options.constraints);
        // Expression-valued dimensions reference named parameters; re-solve when they change.
        PubSub.default.sub("parametersChanged", this.onParametersChanged);
    }

    private readonly onParametersChanged = (document: IDocument) => {
        if (document === this.document) {
            this.setShape(this.generateShape());
        }
    };

    override disposeInternal(): void {
        PubSub.default.remove("parametersChanged", this.onParametersChanged);
        super.disposeInternal();
    }

    /** The solved 2D positions of every sketch point (constraints applied). Falls back to the stored
     * positions when the system does not converge, so callers always get one position per point. */
    solvedPoints(): Point2d[] {
        const scope = new ParameterStore(this.document).resolve();
        const parameters = scope.isOk ? scope.value : {};
        const solved = solveConstraints(
            this.points,
            this.constraints.map((c) => toConstraint(c, parameters)),
        );
        return solved.converged ? solved.points : this.points;
    }

    /** Map a world-space point on the sketch plane (e.g. a picked vertex) to the index of the nearest
     * sketch point. Returns -1 when the sketch has no points. The IShape geometry is built in
     * plane-absolute coordinates, so a picked vertex's `point()` projects straight onto the plane. */
    nearestPointIndex(planePoint: XYZ): number {
        const plane = this.plane;
        const d = planePoint.sub(plane.origin);
        const u = d.dot(plane.xvec);
        const v = d.dot(plane.yvec);
        const solved = this.solvedPoints();
        let best = -1;
        let bestDist = Number.POSITIVE_INFINITY;
        solved.forEach((p, i) => {
            const dist = Math.hypot(p.x - u, p.y - v);
            if (dist < bestDist) {
                bestDist = dist;
                best = i;
            }
        });
        return best;
    }

    /** Append a constraint and re-solve. The `constraints` setter emits a shape change, so the sketch
     * rebuilds to satisfy the new constraint (or reports over-constrained via {@link constraintStatus}). */
    addConstraint(constraint: SketchConstraint): void {
        this.constraints = [...this.constraints, constraint];
    }

    generateShape(): Result<IShape> {
        const scope = new ParameterStore(this.document).resolve();
        const parameters = scope.isOk ? scope.value : {};
        const solved = solveConstraints(
            this.points,
            this.constraints.map((c) => toConstraint(c, parameters)),
        );
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
