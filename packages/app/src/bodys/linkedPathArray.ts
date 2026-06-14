// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IEdge,
    type IShape,
    Matrix4,
    property,
    ReferenceShapeNode,
    Result,
    ShapeTypes,
    serializable,
    serialize,
} from "@chili3d/core";

export interface LinkedPathArrayOptions {
    document: IDocument;
    sourceId: string;
    pathId: string;
    count: number;
}

/**
 * A referential path pattern: `count` copies of a source placed evenly along a path curve, combined
 * into a compound that rebuilds when the source or path changes. References TWO inputs (source +
 * path), exercising multi-input referential rebuild.
 */
@serializable()
export class LinkedPathArrayNode extends ReferenceShapeNode {
    override display(): I18nKeys {
        return "body.linkedPathArray";
    }

    @serialize()
    @property("linkedArray.count")
    get count(): number {
        return this.getPrivateValue("count");
    }
    set count(value: number) {
        this.setPropertyEmitShapeChanged("count", value);
    }

    constructor(options: LinkedPathArrayOptions) {
        super({ document: options.document, inputIds: [options.sourceId, options.pathId] });
        this.setPrivateValue("count", options.count);
    }

    override generateShape(): Result<IShape> {
        const shapes = this.resolveInputShapes();
        if (shapes.length < 2) {
            return Result.err("Linked path array needs a source and a path");
        }
        const [source, path] = shapes;
        const edges =
            path.shapeType === ShapeTypes.edge
                ? [path as IEdge]
                : (path.findSubShapes(ShapeTypes.edge) as IEdge[]);
        if (edges.length === 0) {
            return Result.err("The path has no edge to follow");
        }
        const count = Math.max(1, Math.floor(this.count));
        // uniformAbscissaByCount(n) returns n+1 points (n divisions); take exactly `count`.
        const points = edges[0].curve.uniformAbscissaByCount(count).slice(0, count);
        const copies = points.map((p) => source.transformedMul(Matrix4.fromTranslation(p.x, p.y, p.z)));
        return shapeFactory.combine(copies);
    }
}
