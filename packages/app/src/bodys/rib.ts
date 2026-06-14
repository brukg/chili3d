// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    ParameterShapeNode,
    Result,
    serializable,
    serialize,
} from "@chili3d/core";

export interface RibOptions {
    document: IDocument;
    ribShape: IShape;
}

@serializable()
export class RibNode extends ParameterShapeNode {
    override display(): I18nKeys {
        return "body.rib";
    }

    @serialize()
    get ribShape(): IShape {
        return this.getPrivateValue("ribShape");
    }

    constructor(options: RibOptions) {
        super(options);
        this.setPrivateValue("ribShape", options.ribShape);
    }

    override generateShape(): Result<IShape> {
        return Result.ok(this.ribShape);
    }
}
