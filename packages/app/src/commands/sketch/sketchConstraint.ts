// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IShape,
    type IStep,
    type IVertex,
    PubSub,
    property,
    SelectShapeStep,
    type ShapeNode,
    type ShapeType,
    ShapeTypes,
    type SketchConstraint,
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

    protected buildConstraint(_node: SketchNode, [a, b]: number[]): SketchConstraint | undefined {
        return a === b ? undefined : { type: "distance", a, b, d: this.distance };
    }
}

// Horizontal dimension: the signed X distance from the first picked point to the second equals the
// value — Fusion's horizontal dimension. Inherits the distance property and 2-vertex selection.
@command({ key: "sketch.dimensionX", icon: "icon-dimension" })
export class SketchDimensionXCommand extends SketchDimensionCommand {
    protected override buildConstraint(_node: SketchNode, [a, b]: number[]): SketchConstraint | undefined {
        return a === b ? undefined : { type: "distanceX", a, b, dx: this.distance };
    }
}

// Vertical dimension: the signed Y distance from the first picked point to the second equals the value.
@command({ key: "sketch.dimensionY", icon: "icon-dimension" })
export class SketchDimensionYCommand extends SketchDimensionCommand {
    protected override buildConstraint(_node: SketchNode, [a, b]: number[]): SketchConstraint | undefined {
        return a === b ? undefined : { type: "distanceY", a, b, dy: this.distance };
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
