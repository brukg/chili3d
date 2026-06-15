// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { property } from "../property";
import { serializable, serialize } from "../serialize";
import { GroupNode } from "./groupNode";

/**
 * How the link's collision geometry is exported. `convex` emits a convex hull of the link mesh — the
 * tight-yet-cheap collider robotics planners and physics engines prefer, and the default. `box` emits
 * a single axis-aligned bounding box — cheapest, but loose. `mesh` reuses the full visual mesh —
 * exact, but slow and unstable in collision checking.
 */
export type CollisionGeometry = "convex" | "box" | "mesh";

const COLLISION_GEOMETRIES: readonly CollisionGeometry[] = ["convex", "box", "mesh"];

/**
 * A named rigid body in a kinematic tree. Its direct geometry children are the link's
 * visual geometry; its JointNode children connect it to child links. Maps to a URDF <link>.
 */
@serializable()
export class LinkNode extends GroupNode {
    @serialize()
    @property("link.mass")
    get mass(): number {
        return this.getPrivateValue("mass", 1);
    }
    set mass(value: number) {
        this.setProperty("mass", value);
    }

    @serialize()
    @property("link.collision", { type: "select", options: COLLISION_GEOMETRIES })
    get collisionGeometry(): CollisionGeometry {
        return this.getPrivateValue("collisionGeometry", "convex");
    }
    set collisionGeometry(value: CollisionGeometry) {
        if (!COLLISION_GEOMETRIES.includes(value)) return;
        this.setProperty("collisionGeometry", value);
    }
}
