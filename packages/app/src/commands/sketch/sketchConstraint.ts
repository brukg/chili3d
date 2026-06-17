// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CurveUtils,
    command,
    type ICurve,
    type IEdge,
    type IShape,
    type IStep,
    type ITrimmedCurve,
    type IVertex,
    PubSub,
    property,
    SelectShapeStep,
    type ShapeNode,
    type ShapeType,
    ShapeTypes,
    type SketchConstraint,
    type SketchDimension,
    Transaction,
    type VisualShapeData,
} from "@chili3d/core";
import { SketchNode } from "../../bodys";
import { MultistepCommand } from "../multistepCommand";

/**
 * Base class for the interactive sketch-constraint commands. The user picks one or more sub-shapes
 * (vertices or edges) of a single {@link SketchNode}; the command maps each pick back to the sketch's
 * point indices and appends a {@link SketchConstraint}, which re-solves the sketch automatically.
 */
abstract class SketchConstraintCommand extends MultistepCommand {
    /** Sub-shape kind the user selects — sketch vertices (points) or edges (segments). */
    protected abstract readonly subShapeType: ShapeType;
    /** Exact number of sub-shapes the constraint needs (e.g. 2 points, 2 segments, 1 point). */
    protected abstract readonly count: number;

    /** Build the constraint descriptor from the resolved point indices, or `undefined` to abort. */
    protected abstract buildConstraint(node: SketchNode, indices: number[]): SketchConstraint | undefined;

    protected override getSteps(): IStep[] {
        const prompt =
            this.subShapeType === ShapeTypes.edge ? "prompt.select.edges" : "prompt.select.vertexes";
        return [
            new SelectShapeStep(this.subShapeType, prompt, {
                multiple: true,
                nodeFilter: { allow: (node) => node instanceof SketchNode },
            }),
        ];
    }

    protected override executeMainTask(): void {
        const shapes = this.stepDatas[0].shapes;
        const node = shapes[0]?.owner.node as ShapeNode | undefined;
        if (!(node instanceof SketchNode) || shapes.length !== this.count) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }
        // Every pick must be on the same sketch — cross-sketch constraints are meaningless.
        if (shapes.some((s) => s.owner.node !== node)) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }

        const indices = this.resolveIndices(node, shapes);
        if (indices.some((i) => i < 0)) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }

        const constraint = this.buildConstraint(node, indices);
        if (!constraint) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }

        Transaction.execute(this.document, `add ${constraint.type} constraint`, () => {
            node.addConstraint(constraint);
        });
        this.document.visual.update();
    }

    /** Resolve each selected sub-shape to the sketch point indices it spans (1 per vertex, 2 per edge). */
    private resolveIndices(node: SketchNode, shapes: VisualShapeData[]): number[] {
        const indices: number[] = [];
        for (const data of shapes) {
            if (this.subShapeType === ShapeTypes.edge) {
                indices.push(...this.edgeIndices(node, data.shape));
            } else {
                indices.push(node.nearestPointIndex((data.shape as IVertex).point()));
            }
        }
        return indices;
    }

    /** An edge spans two sketch points; map each of its endpoint vertices to a point index. */
    private edgeIndices(node: SketchNode, edge: IShape): [number, number] {
        const verts = edge.findSubShapes(ShapeTypes.vertex) as IVertex[];
        if (verts.length < 2) return [-1, -1];
        return [node.nearestPointIndex(verts[0].point()), node.nearestPointIndex(verts[1].point())];
    }
}

@command({ key: "sketch.constrainHorizontal", icon: "icon-line" })
export class SketchHorizontalCommand extends SketchConstraintCommand {
    protected readonly subShapeType = ShapeTypes.vertex;
    protected readonly count = 2;
    protected buildConstraint(_node: SketchNode, [a, b]: number[]): SketchConstraint | undefined {
        return a === b ? undefined : { type: "horizontal", a, b };
    }
}

@command({ key: "sketch.constrainVertical", icon: "icon-line" })
export class SketchVerticalCommand extends SketchConstraintCommand {
    protected readonly subShapeType = ShapeTypes.vertex;
    protected readonly count = 2;
    protected buildConstraint(_node: SketchNode, [a, b]: number[]): SketchConstraint | undefined {
        return a === b ? undefined : { type: "vertical", a, b };
    }
}

@command({ key: "sketch.constrainCoincident", icon: "icon-circle" })
export class SketchCoincidentCommand extends SketchConstraintCommand {
    protected readonly subShapeType = ShapeTypes.vertex;
    protected readonly count = 2;
    protected buildConstraint(_node: SketchNode, [a, b]: number[]): SketchConstraint | undefined {
        return a === b ? undefined : { type: "coincident", a, b };
    }
}

@command({ key: "sketch.constrainFix", icon: "icon-lock" })
export class SketchFixCommand extends SketchConstraintCommand {
    protected readonly subShapeType = ShapeTypes.vertex;
    protected readonly count = 1;
    protected buildConstraint(node: SketchNode, [point]: number[]): SketchConstraint | undefined {
        const p = node.solvedPoints()[point];
        return p ? { type: "fixed", point, x: p.x, y: p.y } : undefined;
    }
}

@command({ key: "sketch.constrainParallel", icon: "icon-line" })
export class SketchParallelCommand extends SketchConstraintCommand {
    protected readonly subShapeType = ShapeTypes.edge;
    protected readonly count = 2;
    protected buildConstraint(_node: SketchNode, [a, b, c, d]: number[]): SketchConstraint | undefined {
        return { type: "parallel", a, b, c, d };
    }
}

@command({ key: "sketch.constrainPerpendicular", icon: "icon-line" })
export class SketchPerpendicularCommand extends SketchConstraintCommand {
    protected readonly subShapeType = ShapeTypes.edge;
    protected readonly count = 2;
    protected buildConstraint(_node: SketchNode, [a, b, c, d]: number[]): SketchConstraint | undefined {
        return { type: "perpendicular", a, b, c, d };
    }
}

@command({ key: "sketch.constrainEqual", icon: "icon-line" })
export class SketchEqualCommand extends SketchConstraintCommand {
    protected readonly subShapeType = ShapeTypes.edge;
    protected readonly count = 2;
    protected buildConstraint(_node: SketchNode, [a, b, c, d]: number[]): SketchConstraint | undefined {
        return { type: "equalLength", a, b, c, d };
    }
}

@command({ key: "sketch.constrainCollinear", icon: "icon-line" })
export class SketchCollinearCommand extends SketchConstraintCommand {
    protected readonly subShapeType = ShapeTypes.edge;
    protected readonly count = 2;
    protected buildConstraint(_node: SketchNode, [a, b, c, d]: number[]): SketchConstraint | undefined {
        return { type: "collinear", a, b, c, d };
    }
}

@command({ key: "sketch.constrainConcentric", icon: "icon-circle" })
export class SketchConcentricCommand extends SketchConstraintCommand {
    protected readonly subShapeType = ShapeTypes.edge;
    protected readonly count = 2;
    protected buildConstraint(_node: SketchNode, [a, b, c, d]: number[]): SketchConstraint | undefined {
        return { type: "concentric", a, b, c, d };
    }
}

// Tangent (circles): make two sketch circles externally tangent. Only valid between two circular
// edges (each a 2-point bulge circle), so the command rejects non-circular picks rather than apply a
// meaningless constraint.
@command({ key: "sketch.constrainTangent", icon: "icon-circle" })
export class SketchTangentCommand extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", {
                multiple: true,
                nodeFilter: { allow: (node) => node instanceof SketchNode },
            }),
        ];
    }

    protected override executeMainTask(): void {
        const shapes = this.stepDatas[0].shapes;
        const node = shapes[0]?.owner.node as ShapeNode | undefined;
        if (!(node instanceof SketchNode) || shapes.length !== 2) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }
        if (shapes.some((s) => s.owner.node !== node) || !shapes.every((s) => this.isCircular(s.shape))) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }

        const [first, second] = shapes.map((s) => s.shape.findSubShapes(ShapeTypes.vertex) as IVertex[]);
        if (first.length < 2 || second.length < 2) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }
        const idx = [
            node.nearestPointIndex(first[0].point()),
            node.nearestPointIndex(first[1].point()),
            node.nearestPointIndex(second[0].point()),
            node.nearestPointIndex(second[1].point()),
        ];
        if (idx.some((i) => i < 0)) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }

        Transaction.execute(this.document, "add tangent constraint", () => {
            node.addConstraint({ type: "tangent", a: idx[0], b: idx[1], c: idx[2], d: idx[3] });
        });
        this.document.visual.update();
    }

    private isCircular(edge: IShape): boolean {
        const curve = (edge as IEdge).curve as ICurve | undefined;
        if (!curve) return false;
        if (CurveUtils.isCircle(curve)) return true;
        const basis = (curve as ITrimmedCurve).basisCurve;
        return !!basis && CurveUtils.isCircle(basis);
    }
}

@command({ key: "sketch.dimension", icon: "icon-dimension" })
export class SketchDimensionCommand extends SketchConstraintCommand {
    protected readonly subShapeType = ShapeTypes.vertex;
    protected readonly count = 2;

    @property("common.length")
    get distance() {
        return this.getPrivateValue("distance", 50);
    }
    set distance(value: number) {
        this.setProperty("distance", value);
    }

    // Optional expression (e.g. "width / 2") evaluated against the document's named parameters. When
    // set, it drives the dimension instead of the literal value — the heart of a parametric sketch.
    @property("parameter.expression")
    get expression() {
        return this.getPrivateValue("expression", "");
    }
    set expression(value: string) {
        this.setProperty("expression", value);
    }

    /** The dimension value the constraint should use: the expression if one was entered, else the
     * literal number. A string is resolved against the document parameters when the sketch solves. */
    protected dimValue(): SketchDimension {
        return this.expression.trim().length > 0 ? this.expression : this.distance;
    }

    protected buildConstraint(_node: SketchNode, [a, b]: number[]): SketchConstraint | undefined {
        return a === b ? undefined : { type: "distance", a, b, d: this.dimValue() };
    }
}

// Horizontal dimension: the signed X distance from the first picked point to the second equals the
// value — Fusion's horizontal dimension. Inherits the distance/expression props and 2-vertex selection.
@command({ key: "sketch.dimensionX", icon: "icon-dimension" })
export class SketchDimensionXCommand extends SketchDimensionCommand {
    protected override buildConstraint(_node: SketchNode, [a, b]: number[]): SketchConstraint | undefined {
        return a === b ? undefined : { type: "distanceX", a, b, dx: this.dimValue() };
    }
}

// Vertical dimension: the signed Y distance from the first picked point to the second equals the value.
@command({ key: "sketch.dimensionY", icon: "icon-dimension" })
export class SketchDimensionYCommand extends SketchDimensionCommand {
    protected override buildConstraint(_node: SketchNode, [a, b]: number[]): SketchConstraint | undefined {
        return a === b ? undefined : { type: "distanceY", a, b, dy: this.dimValue() };
    }
}

// Angle dimension: constrain the angle between two picked sketch segments to a value in degrees —
// Fusion's angular dimension. The solver works in radians, so the degree value is converted here.
@command({ key: "sketch.dimensionAngle", icon: "icon-dimension" })
export class SketchAngleCommand extends SketchConstraintCommand {
    protected readonly subShapeType = ShapeTypes.edge;
    protected readonly count = 2;

    @property("common.angle")
    get angle() {
        return this.getPrivateValue("angle", 45);
    }
    set angle(value: number) {
        this.setProperty("angle", value);
    }

    protected buildConstraint(_node: SketchNode, [a, b, c, d]: number[]): SketchConstraint | undefined {
        return { type: "angle", a, b, c, d, radians: (this.angle * Math.PI) / 180 };
    }
}

// Point-on-line: pin a sketch point onto the line through a segment — Fusion's collinear/on-line
// constraint. Needs one vertex and one edge, so it picks a mixed selection rather than a single kind.
@command({ key: "sketch.constrainPointOnLine", icon: "icon-line" })
export class SketchPointOnLineCommand extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep((ShapeTypes.vertex | ShapeTypes.edge) as ShapeType, "prompt.select.shape", {
                multiple: true,
                nodeFilter: { allow: (node) => node instanceof SketchNode },
            }),
        ];
    }

    protected override executeMainTask(): void {
        const shapes = this.stepDatas[0].shapes;
        const node = shapes[0]?.owner.node as ShapeNode | undefined;
        const vertex = shapes.find((s) => s.shape.shapeType === ShapeTypes.vertex);
        const edge = shapes.find((s) => s.shape.shapeType === ShapeTypes.edge);
        if (!(node instanceof SketchNode) || shapes.length !== 2 || !vertex || !edge) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }
        if (shapes.some((s) => s.owner.node !== node)) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }

        const point = node.nearestPointIndex((vertex.shape as IVertex).point());
        const verts = edge.shape.findSubShapes(ShapeTypes.vertex) as IVertex[];
        if (verts.length < 2) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }
        const a = node.nearestPointIndex(verts[0].point());
        const b = node.nearestPointIndex(verts[1].point());
        if ([point, a, b].some((i) => i < 0) || point === a || point === b) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }

        Transaction.execute(this.document, "add pointOnLine constraint", () => {
            node.addConstraint({ type: "pointOnLine", point, a, b });
        });
        this.document.visual.update();
    }
}

// Midpoint: pin a sketch point to the midpoint of a picked segment — Fusion's midpoint constraint.
// Picks one vertex and one edge.
@command({ key: "sketch.constrainMidpoint", icon: "icon-line" })
export class SketchMidpointCommand extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep((ShapeTypes.vertex | ShapeTypes.edge) as ShapeType, "prompt.select.shape", {
                multiple: true,
                nodeFilter: { allow: (node) => node instanceof SketchNode },
            }),
        ];
    }

    protected override executeMainTask(): void {
        const shapes = this.stepDatas[0].shapes;
        const node = shapes[0]?.owner.node as ShapeNode | undefined;
        const vertex = shapes.find((s) => s.shape.shapeType === ShapeTypes.vertex);
        const edge = shapes.find((s) => s.shape.shapeType === ShapeTypes.edge);
        if (!(node instanceof SketchNode) || shapes.length !== 2 || !vertex || !edge) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }
        if (shapes.some((s) => s.owner.node !== node)) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }

        const point = node.nearestPointIndex((vertex.shape as IVertex).point());
        const verts = edge.shape.findSubShapes(ShapeTypes.vertex) as IVertex[];
        if (verts.length < 2) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }
        const a = node.nearestPointIndex(verts[0].point());
        const b = node.nearestPointIndex(verts[1].point());
        if ([point, a, b].some((i) => i < 0) || point === a || point === b) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }

        Transaction.execute(this.document, "add midpoint constraint", () => {
            node.addConstraint({ type: "midpoint", point, a, b });
        });
        this.document.visual.update();
    }
}

// Symmetric: make two sketch points mirror-symmetric about the line through a picked segment —
// Fusion's symmetry constraint. Picks two vertices (the symmetric pair) and one edge (the axis).
@command({ key: "sketch.constrainSymmetric", icon: "icon-line" })
export class SketchSymmetricCommand extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep((ShapeTypes.vertex | ShapeTypes.edge) as ShapeType, "prompt.select.shape", {
                multiple: true,
                nodeFilter: { allow: (node) => node instanceof SketchNode },
            }),
        ];
    }

    protected override executeMainTask(): void {
        const shapes = this.stepDatas[0].shapes;
        const node = shapes[0]?.owner.node as ShapeNode | undefined;
        const vertices = shapes.filter((s) => s.shape.shapeType === ShapeTypes.vertex);
        const edge = shapes.find((s) => s.shape.shapeType === ShapeTypes.edge);
        if (!(node instanceof SketchNode) || shapes.length !== 3 || vertices.length !== 2 || !edge) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }
        if (shapes.some((s) => s.owner.node !== node)) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }

        const p = node.nearestPointIndex((vertices[0].shape as IVertex).point());
        const q = node.nearestPointIndex((vertices[1].shape as IVertex).point());
        const verts = edge.shape.findSubShapes(ShapeTypes.vertex) as IVertex[];
        if (verts.length < 2) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }
        const a = node.nearestPointIndex(verts[0].point());
        const b = node.nearestPointIndex(verts[1].point());
        if ([p, q, a, b].some((i) => i < 0) || p === q) {
            PubSub.default.pub("showToast", "toast.sketch.invalidSelection");
            return;
        }

        Transaction.execute(this.document, "add symmetric constraint", () => {
            node.addConstraint({ type: "symmetric", p, q, a, b });
        });
        this.document.visual.update();
    }
}
