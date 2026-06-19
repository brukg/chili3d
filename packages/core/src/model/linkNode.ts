// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { XYZ } from "../math";
import { property } from "../property";
import { serializable, serialize } from "../serialize";
import { type ISolid, ShapeTypes } from "../shape";
import { GroupNode } from "./groupNode";
import { JointNode } from "./jointNode";
import { type INodeLinkedList, NodeUtils } from "./node";
import { ShapeNode } from "./shapeNode";

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

    /**
     * When true, the link exports the stored {@link inertialCenter}/{@link momentOfInertia}/
     * {@link productOfInertia} instead of computing the tensor from the geometry. Set automatically on
     * import of a URDF that specifies an explicit `<inertial>` so hand-authored values survive the
     * round-trip; clear it to fall back to the (geometry-exact) computed inertia.
     */
    @serialize()
    @property("link.overrideInertia")
    get overrideInertia(): boolean {
        return this.getPrivateValue("overrideInertia", false);
    }
    set overrideInertia(value: boolean) {
        this.setProperty("overrideInertia", value);
    }

    /** Centre of mass for the inertia override, in millimetres (the URDF `<inertial>` origin). */
    @serialize()
    get inertialCenter(): XYZ {
        return this.getPrivateValue("inertialCenter", XYZ.zero);
    }
    set inertialCenter(value: XYZ) {
        this.setProperty("inertialCenter", value);
    }

    /** Diagonal inertia (Ixx, Iyy, Izz) for the override, in SI kg·m² (URDF units). */
    @serialize()
    get momentOfInertia(): XYZ {
        return this.getPrivateValue("momentOfInertia", XYZ.zero);
    }
    set momentOfInertia(value: XYZ) {
        this.setProperty("momentOfInertia", value);
    }

    /** Products of inertia (Ixy, Ixz, Iyz) for the override, in SI kg·m² (URDF units). */
    @serialize()
    get productOfInertia(): XYZ {
        return this.getPrivateValue("productOfInertia", XYZ.zero);
    }
    set productOfInertia(value: XYZ) {
        this.setProperty("productOfInertia", value);
    }

    /** A link is mass-bearing: applying a physical material sets its mass from the material density and
     * the link's own geometry volume (mass = density · volume). Appearance is untouched. */
    protected override applyPhysicalMaterial(density: number): void {
        this.mass = density * this.ownSolidVolume() * 1e-9; // density kg/m³ · volume mm³ → kg
    }

    // Total volume (mm³) of the link's own solids, descending through folders/groups but stopping at
    // nested links/joints (their geometry belongs to them). Volume is placement-invariant.
    private ownSolidVolume(): number {
        let volume = 0;
        const walk = (parent: INodeLinkedList) => {
            let n = parent.firstChild;
            while (n) {
                if (!(n instanceof LinkNode || n instanceof JointNode)) {
                    if (n instanceof ShapeNode && n.shape.isOk) {
                        for (const sub of n.shape.value.findSubShapes(ShapeTypes.solid)) {
                            volume += (sub as ISolid).massProperties().volume;
                        }
                    } else if (NodeUtils.isLinkedListNode(n)) {
                        walk(n);
                    }
                }
                n = n.nextSibling;
            }
        };
        walk(this);
        return volume;
    }
}
