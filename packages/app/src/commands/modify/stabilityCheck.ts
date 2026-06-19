// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    combinedCenterOfMass,
    command,
    convexHull2D,
    type IApplication,
    type ICommand,
    type INodeLinkedList,
    type IVertex,
    PubSub,
    ShapeTypes,
    stabilityMargin,
    type Vec2,
} from "@chili3d/core";
import { robotPointMasses, robotWorldSolids } from "./robotModel";

// Geometry vertices within this many millimetres of the lowest point count as ground contacts.
const CONTACT_TOLERANCE = 1;

/**
 * Stability Check: does the robot tip over in its current pose? Builds the support polygon as the convex
 * hull of the lowest geometry points (the ground contacts), projects the whole-robot centre of mass onto
 * the ground plane, and reports the stability margin — the signed distance to the nearest tipping edge.
 * Positive means stable (the larger the safer); non-positive means it tips. Uses the same mass model as
 * Robot Center of Mass and the static-stability core.
 */
@command({
    key: "modify.stabilityCheck",
    icon: "icon-measureSelect",
})
export class StabilityCheckCommand implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const document = application.activeView?.document;
        if (!document) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const com = combinedCenterOfMass(robotPointMasses(document.modelManager.rootNode));
        if (!com) {
            PubSub.default.pub("showToast", "toast.robot.noLinks");
            return;
        }

        const contacts = this.groundContacts(document.modelManager.rootNode);
        if (contacts.length === 0) {
            PubSub.default.pub("showToast", "toast.robot.noLinks");
            return;
        }
        const support = convexHull2D(contacts);
        const margin = stabilityMargin({ x: com.x, y: com.y }, support);
        const key = margin > 0 ? "toast.robot.stable:{0}" : "toast.robot.unstable:{0}";
        PubSub.default.pub("showToast", key, margin.toFixed(2));
    }

    // The XY of every geometry vertex within CONTACT_TOLERANCE of the robot's lowest point (min Z, Z up).
    private groundContacts(root: INodeLinkedList): Vec2[] {
        const points: { x: number; y: number; z: number }[] = [];
        for (const solid of robotWorldSolids(root)) {
            for (const v of solid.findSubShapes(ShapeTypes.vertex)) {
                const p = (v as IVertex).point();
                points.push({ x: p.x, y: p.y, z: p.z });
            }
        }
        if (points.length === 0) return [];
        let minZ = Number.POSITIVE_INFINITY;
        for (const p of points) if (p.z < minZ) minZ = p.z;
        return points.filter((p) => p.z <= minZ + CONTACT_TOLERANCE).map((p) => ({ x: p.x, y: p.y }));
    }
}
