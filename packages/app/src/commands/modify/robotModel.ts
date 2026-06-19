// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

// Shared kinematic-mass model for the robot commands (Estimate Torque, Center of Mass, Stability,
// Payload). Turns a node subtree into the physical data the analyses need: each link as a point mass at
// its world centre of mass, the world solids for contact/extent queries, and node world transforms. All
// world transforms are composed from the ancestor chain so they work without a rendered visual context.

import {
    type INode,
    type INodeLinkedList,
    type IShape,
    type ISolid,
    JointNode,
    LinkNode,
    Matrix4,
    NodeUtils,
    type PointMass,
    ShapeNode,
    ShapeTypes,
    XYZ,
} from "@chili3d/core";

/**
 * World transform of a node, composed from the ancestor chain (root-most first). Independent of the
 * rendered visual context, so it works headlessly and for nodes that carry no visual.
 */
export function worldTransformOf(node: INode): Matrix4 {
    const chain: INode[] = [];
    let cur: INode | undefined = node;
    while (cur) {
        chain.push(cur);
        cur = cur.parent;
    }
    let m = Matrix4.identity();
    for (let i = chain.length - 1; i >= 0; i--) {
        const t = (chain[i] as { transform?: unknown }).transform;
        if (t instanceof Matrix4) m = m.multiply(t);
    }
    return m;
}

/** Every solid belonging to a link's OWN geometry, in world coordinates. Descends through folders/groups
 * but stops at nested links/joints (their geometry belongs to them). */
export function linkWorldSolids(link: LinkNode): ISolid[] {
    const solids: ISolid[] = [];
    const walk = (parent: INodeLinkedList) => {
        let n = parent.firstChild;
        while (n) {
            if (!(n instanceof LinkNode || n instanceof JointNode)) {
                if (n instanceof ShapeNode && n.shape.isOk) {
                    const world: IShape = n.shape.value.transformedMul(worldTransformOf(n));
                    for (const sub of world.findSubShapes(ShapeTypes.solid)) solids.push(sub as ISolid);
                } else if (NodeUtils.isLinkedListNode(n)) {
                    walk(n);
                }
            }
            n = n.nextSibling;
        }
    };
    walk(link);
    return solids;
}

/**
 * Volume-weighted world centre of mass of a link's own solids, or the link-frame origin in world when
 * the link has no solids (a surface-only or empty link still carries its authored mass).
 */
export function linkWorldCenterOfMass(link: LinkNode): XYZ {
    let volume = 0;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const solid of linkWorldSolids(link)) {
        const mp = solid.massProperties();
        if (mp.volume > 1e-9) {
            volume += mp.volume;
            x += mp.centerOfMass.x * mp.volume;
            y += mp.centerOfMass.y * mp.volume;
            z += mp.centerOfMass.z * mp.volume;
        }
    }
    if (volume <= 1e-9) return worldTransformOf(link).ofPoint(XYZ.zero);
    return new XYZ({ x: x / volume, y: y / volume, z: z / volume });
}

/**
 * Every {@link LinkNode} under `root` as a point mass at its world centre of mass, using the link's
 * authored {@link LinkNode.mass}. The full load a parent joint (or the whole robot) carries.
 */
export function robotPointMasses(root: INodeLinkedList): PointMass[] {
    const links = NodeUtils.findNodes(root, (n) => n instanceof LinkNode) as LinkNode[];
    return links.map((link) => ({ center: linkWorldCenterOfMass(link), mass: link.mass }));
}

/** Every solid of every {@link LinkNode} under `root`, in world coordinates — for contact/extent
 * queries (e.g. the ground-contact points that form the support polygon). */
export function robotWorldSolids(root: INodeLinkedList): ISolid[] {
    const links = NodeUtils.findNodes(root, (n) => n instanceof LinkNode) as LinkNode[];
    const out: ISolid[] = [];
    for (const link of links) out.push(...linkWorldSolids(link));
    return out;
}
