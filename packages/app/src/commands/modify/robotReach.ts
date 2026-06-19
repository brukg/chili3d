// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type IApplication,
    type ICommand,
    type INode,
    type IVertex,
    JointNode,
    LinkNode,
    NodeUtils,
    PubSub,
    ShapeTypes,
    XYZ,
} from "@chili3d/core";
import { robotWorldSolids, worldTransformOf } from "./robotModel";

/**
 * Robot Reach: the current-pose reach envelope — the maximum distance (mm) from the base link's origin to
 * any geometry point on the robot. This is the bounding radius of the workspace at the present joint
 * values; straighten the arm (zero the joints) to read the fully-extended reach. The base is the link
 * with no link/joint ancestor; with none found, distances are measured from the world origin.
 */
@command({
    key: "modify.robotReach",
    icon: "icon-measureSelect",
})
export class RobotReachCommand implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const document = application.activeView?.document;
        if (!document) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const root = document.modelManager.rootNode;
        const solids = robotWorldSolids(root);
        if (solids.length === 0) {
            PubSub.default.pub("showToast", "toast.robot.noLinks");
            return;
        }

        const base = (NodeUtils.findNodes(root, (n) => n instanceof LinkNode) as LinkNode[]).find(
            (l) => !hasKinematicAncestor(l),
        );
        const origin = base ? worldTransformOf(base).ofPoint(XYZ.zero) : XYZ.zero;

        let maxDistSq = 0;
        for (const solid of solids) {
            for (const v of solid.findSubShapes(ShapeTypes.vertex)) {
                const p = (v as IVertex).point();
                const dx = p.x - origin.x;
                const dy = p.y - origin.y;
                const dz = p.z - origin.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq > maxDistSq) maxDistSq = distSq;
            }
        }
        PubSub.default.pub("showToast", "toast.robot.reach:{0}", Math.sqrt(maxDistSq).toFixed(2));
    }
}

// True when any ancestor of the node is a link or joint — i.e. the node is not at the top of a chain.
function hasKinematicAncestor(node: INode): boolean {
    let p: INode | undefined = node.parent;
    while (p) {
        if (p instanceof LinkNode || p instanceof JointNode) return true;
        p = p.parent;
    }
    return false;
}
