// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

// Kinematic reach over a joint tree (robot-building foundation). The fully-extended (straightened) reach
// of an articulated robot is the longest root-to-leaf path through its kinematic tree, summing the rigid
// link lengths along the way — pose-invariant, because the distance between a parent joint and its child
// joint is fixed by the link between them regardless of joint angle. Pure tree recursion, so it is
// directly unit-testable; the command builds the tree from the model and supplies the lengths.

/** A node in the kinematic reach tree: the link length from its parent, and the joints/tips it feeds. */
export interface ReachNode {
    /** Rigid link length (same unit as the inputs, mm in Chili3D) from the parent node to this one. */
    length: number;
    /** Downstream nodes — child joints and terminal tip extents. */
    children: ReachNode[];
}

/**
 * Longest root-to-leaf path length through the tree: this node's link length plus the longest of its
 * children's chains (0 when it is a leaf). For the robot's base node (length 0) this is the straightened
 * reach — the farthest the end effector can get from the base.
 */
export function longestChain(node: ReachNode): number {
    let childMax = 0;
    for (const child of node.children) {
        const chain = longestChain(child);
        if (chain > childMax) childMax = chain;
    }
    return node.length + childMax;
}
