// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IApplication,
    type ICommand,
    type INode,
    type INodeLinkedList,
    type IVertex,
    JointNode,
    LinkNode,
    longestChain,
    NodeUtils,
    PubSub,
    type ReachNode,
    ShapeTypes,
    XYZ,
    type XYZLike,
} from "@chili3d/core";
import { linkWorldSolids, worldTransformOf } from "./robotModel";

/**
 * Straightened Reach: the robot's fully-extended reach — the longest chain of rigid link lengths from the
 * base through the kinematic tree to the farthest tip, plus the end link's own extent. Unlike Robot Reach
 * (the current-pose bounding radius) this is pose-invariant: it's how far the arm could reach if every
 * joint were straightened out. Builds the joint tree and runs the longest-chain core.
 */
@command({
    key: "modify.straightenedReach",
    icon: "icon-measureSelect",
})
export class StraightenedReachCommand implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const document = application.activeView?.document;
        if (!document) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const root = document.modelManager.rootNode;
        const joints = NodeUtils.findNodes(root, (n) => n instanceof JointNode) as JointNode[];
        if (joints.length === 0) {
            PubSub.default.pub("showToast", "toast.robot.noJoints");
            return;
        }

        const pivotOf = (j: JointNode) => worldTransformOf(j).ofPoint(j.pivot);
        const base = (NodeUtils.findNodes(root, (n) => n instanceof LinkNode) as LinkNode[]).find(
            (l) => !hasKinematicAncestor(l),
        );
        const baseOrigin = base ? worldTransformOf(base).ofPoint(XYZ.zero) : XYZ.zero;

        // Direct child joints of a joint J = joints whose nearest joint ancestor is J.
        const childJointsOf = (j: JointNode) => joints.filter((other) => nearestJointAncestor(other) === j);

        const build = (j: JointNode): ReachNode => {
            const parent = nearestJointAncestor(j);
            const from = parent ? pivotOf(parent) : baseOrigin;
            const length = distance(pivotOf(j), from);
            const children = childJointsOf(j).map(build);
            const tip = tipExtent(j, pivotOf(j));
            if (tip > 0) children.push({ length: tip, children: [] });
            return { length, children };
        };

        const roots = joints.filter((j) => nearestJointAncestor(j) === undefined);
        const reach = longestChain({ length: 0, children: roots.map(build) });
        PubSub.default.pub("showToast", "toast.robot.straightReach:{0}", reach.toFixed(2));
    }
}

// Nearest ancestor that is a joint (the joint this one hangs off), or undefined for a base joint.
function nearestJointAncestor(node: INode): JointNode | undefined {
    let p: INode | undefined = node.parent;
    while (p) {
        if (p instanceof JointNode) return p;
        p = p.parent;
    }
    return undefined;
}

// True when any ancestor is a link or joint (i.e. the node is not at the top of a chain).
function hasKinematicAncestor(node: INode): boolean {
    let p: INode | undefined = node.parent;
    while (p) {
        if (p instanceof LinkNode || p instanceof JointNode) return true;
        p = p.parent;
    }
    return false;
}

// Farthest distance from the joint pivot to any vertex of its direct child link's own geometry — the
// terminal extent of the link the joint drives.
function tipExtent(joint: JointNode, pivot: XYZLike): number {
    const link = directChildLink(joint);
    if (!link) return 0;
    let max = 0;
    for (const solid of linkWorldSolids(link)) {
        for (const v of solid.findSubShapes(ShapeTypes.vertex)) {
            const d = distance((v as IVertex).point(), pivot);
            if (d > max) max = d;
        }
    }
    return max;
}

// The first LinkNode under the joint, descending through folders but stopping at a nested joint.
function directChildLink(joint: JointNode): LinkNode | undefined {
    const walk = (parent: INodeLinkedList): LinkNode | undefined => {
        let n = parent.firstChild;
        while (n) {
            if (n instanceof LinkNode) return n;
            if (!(n instanceof JointNode) && NodeUtils.isLinkedListNode(n)) {
                const found = walk(n);
                if (found) return found;
            }
            n = n.nextSibling;
        }
        return undefined;
    };
    return walk(joint);
}

function distance(a: XYZLike, b: XYZLike): number {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
