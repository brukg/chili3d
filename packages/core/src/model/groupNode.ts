// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Matrix4 } from "../math";
import { property } from "../property";
import { serializable, serialize } from "../serialize";
import { FolderNode, type FolderNodeOptions } from "./folderNode";
import { GeometryNode } from "./geometryNode";
import { NodeUtils } from "./node";

export interface GroupNodeOptions extends FolderNodeOptions {}

@serializable()
export class GroupNode extends FolderNode {
    constructor(options: GroupNodeOptions) {
        super(options);
    }

    @serialize()
    get transform(): Matrix4 {
        return this.getPrivateValue("transform", Matrix4.identity());
    }
    set transform(value: Matrix4) {
        this.setProperty("transform", value, undefined, {
            equals: (left, right) => left.equals(right),
        });
    }

    /**
     * Appearance for the whole group: assigning a material id bakes it onto every descendant part
     * (parts are what the renderer paints — a group itself is not drawn). This is how an appearance is
     * applied to a node (group/link/folder), not just an individual part. It carries NO mass — the
     * physical material is a separate axis (see {@link physicalMaterial}). Stored for the property panel
     * to display the group's current appearance; on document load the descendants' baked ids are
     * restored directly, so no re-cascade runs.
     */
    @serialize()
    @property("common.material", { type: "materialId" })
    get materialId(): string | string[] {
        return this.getPrivateValue("materialId", "");
    }
    set materialId(value: string | string[]) {
        this.setProperty("materialId", value, () => {
            for (const node of NodeUtils.findNodes(this, (n) => n instanceof GeometryNode)) {
                (node as GeometryNode).materialId = value;
            }
        });
    }
}
