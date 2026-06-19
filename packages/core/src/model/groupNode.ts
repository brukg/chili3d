// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { findMaterialPreset, MaterialPresets } from "../materialPresets";
import { Matrix4 } from "../math";
import { property } from "../property";
import { serializable, serialize } from "../serialize";
import { FolderNode, type FolderNodeOptions } from "./folderNode";
import { GeometryNode } from "./geometryNode";
import { NodeUtils } from "./node";

const PHYSICAL_MATERIAL_OPTIONS: readonly string[] = MaterialPresets.map((p) => p.id);

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

    /**
     * Physical material for the whole group: assigning one cascades the chosen material's density to
     * every mass-bearing descendant (and to this node if it is one), driving their mass. This is the
     * SEPARATE physical axis — it never changes appearance. Stored for the property panel; descendants'
     * masses are serialized independently, so no re-cascade runs on document load.
     */
    @serialize()
    @property("node.physicalMaterial", { type: "select", options: PHYSICAL_MATERIAL_OPTIONS })
    get physicalMaterial(): string {
        return this.getPrivateValue("physicalMaterial", "");
    }
    set physicalMaterial(value: string) {
        this.setProperty("physicalMaterial", value, () => {
            const preset = findMaterialPreset(value);
            if (!preset) return;
            this.applyPhysicalMaterial(preset.density);
            for (const node of NodeUtils.findNodes(this, (n) => n instanceof GroupNode)) {
                (node as GroupNode).applyPhysicalMaterial(preset.density);
            }
        });
    }

    /**
     * Apply a material density (kg/m³) to this node's own mass. The base group is not mass-bearing, so
     * this is a no-op; {@link LinkNode} overrides it to set its density-driven mass. Kept here (rather
     * than importing LinkNode) so the {@link physicalMaterial} cascade stays free of an import cycle.
     */
    protected applyPhysicalMaterial(_density: number): void {}
}
