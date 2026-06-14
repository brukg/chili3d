// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type INode, JointNode, LinkNode, NodeUtils } from "@chili3d/core";

/**
 * Check a robot's Link/Joint tree for the structural problems that otherwise produce a silently
 * malformed URDF: duplicate link/joint names (URDF requires uniqueness), a joint with no child link
 * (the export drops it), a joint driving more than one link, and a mimic pointing at a joint that is
 * not in the tree. Returns one human-readable message per problem; an empty array means the tree is
 * well-formed. Descends through organisational folders, stopping at nested Link/Joint boundaries.
 */
export function validateRobotTree(root: LinkNode): string[] {
    const issues: string[] = [];
    const linkNames = new Map<string, number>();
    const jointNames = new Map<string, number>();
    const jointIds = new Set<string>();
    const joints: JointNode[] = [];

    const walk = (node: INode) => {
        if (node instanceof LinkNode) linkNames.set(node.name, (linkNames.get(node.name) ?? 0) + 1);
        if (node instanceof JointNode) {
            jointNames.set(node.name, (jointNames.get(node.name) ?? 0) + 1);
            jointIds.add(node.id);
            joints.push(node);
        }
        if (NodeUtils.isLinkedListNode(node)) {
            for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
        }
    };
    walk(root);

    for (const [name, count] of linkNames) {
        if (count > 1) issues.push(`Duplicate link name "${name}" (×${count})`);
    }
    for (const [name, count] of jointNames) {
        if (count > 1) issues.push(`Duplicate joint name "${name}" (×${count})`);
    }

    for (const joint of joints) {
        const childLinks = countChildLinks(joint);
        if (childLinks === 0) issues.push(`Joint "${joint.name}" has no child link`);
        else if (childLinks > 1) issues.push(`Joint "${joint.name}" drives ${childLinks} links (expected 1)`);
        if (joint.mimicJoint && !jointIds.has(joint.mimicJoint)) {
            issues.push(`Joint "${joint.name}" mimics a joint that is not in this robot`);
        }
    }
    return issues;
}

// Links the joint directly drives — reached through folders but not across a nested joint (whose
// child link belongs to it).
function countChildLinks(joint: JointNode): number {
    let count = 0;
    const walk = (node: INode) => {
        for (let c = (node as any).firstChild as INode | undefined; c; c = c.nextSibling) {
            if (c instanceof LinkNode) count++;
            else if (!(c instanceof JointNode) && NodeUtils.isLinkedListNode(c)) walk(c);
        }
    };
    walk(joint);
    return count;
}
