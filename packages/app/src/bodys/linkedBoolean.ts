// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    property,
    ReferenceShapeNode,
    Result,
    serializable,
    serialize,
} from "@chili3d/core";

export type LinkedBooleanType = "common" | "cut" | "fuse";

export interface LinkedBooleanOptions {
    document: IDocument;
    inputIds: string[];
    booleanType: LinkedBooleanType;
}

/**
 * A non-destructive boolean: it references its input nodes by id and recomputes whenever an input
 * changes, instead of baking the result (the destructive `BooleanNode`). Editing an input rebuilds it.
 */
@serializable()
export class LinkedBooleanNode extends ReferenceShapeNode {
    override display(): I18nKeys {
        return "body.linkedBoolean";
    }

    @serialize()
    @property("linkedBoolean.type")
    get booleanType(): LinkedBooleanType {
        return this.getPrivateValue("booleanType");
    }
    set booleanType(value: LinkedBooleanType) {
        this.setPropertyEmitShapeChanged("booleanType", value);
    }

    constructor(options: LinkedBooleanOptions) {
        super({ document: options.document, inputIds: options.inputIds });
        this.setPrivateValue("booleanType", options.booleanType);
    }

    override generateShape(): Result<IShape> {
        const shapes = this.resolveInputShapes();
        if (shapes.length < 2) {
            return Result.err("Linked boolean needs at least two inputs");
        }
        const [first, ...rest] = shapes;
        if (this.booleanType === "common") return shapeFactory.booleanCommon([first], rest);
        if (this.booleanType === "cut") return shapeFactory.booleanCut([first], rest);
        return shapeFactory.booleanFuse([first], rest, true);
    }
}
