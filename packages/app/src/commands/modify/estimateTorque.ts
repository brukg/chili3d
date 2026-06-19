// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    effortUtilization,
    gravityHoldingTorque,
    type IApplication,
    type ICommand,
    type INode,
    type INodeLinkedList,
    type ISolid,
    JointNode,
    LinkNode,
    Matrix4,
    NodeUtils,
    type PointMass,
    PubSub,
    ShapeNode,
    ShapeTypes,
    XYZ,
} from "@chili3d/core";

/**
 * Estimate Torque: for every joint in the robot, the static gravity-holding torque its actuator must
 * supply (N·m) given the mass it carries downstream, compared against its rated `maxEffort`. This is
 * the motor-sizing check — "is each joint strong enough to hold the arm up?". One click reports the
 * peak (binding) joint as a toast and logs the full per-joint table to the console.
 *
 * Physics: each downstream link contributes a point mass at its geometry's world centre of mass
 * (volume-weighted across its solids), using the link's authored {@link LinkNode.mass}. The torque is
 * the gravitational moment about the joint's world axis through its world pivot — see
 * {@link gravityHoldingTorque}. Evaluated at the current pose, in world coordinates, so the result is
 * independent of how the robot is mounted.
 */
@command({
    key: "modify.estimateTorque",
    icon: "icon-measureSelect",
})
export class EstimateTorqueCommand implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const document = application.activeView?.document;
        if (!document) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }
        const joints = NodeUtils.findNodes(
            document.modelManager.rootNode,
            (n) => n instanceof JointNode,
        ) as JointNode[];
        if (joints.length === 0) {
            PubSub.default.pub("showToast", "toast.robot.noJoints");
            return;
        }

        let peak: { joint: JointNode; torque: number; utilization: number } | undefined;
        for (const joint of joints) {
            const masses = this.downstreamPointMasses(joint);
            const axis = worldTransformOf(joint).ofVector(joint.axis);
            const pivot = worldTransformOf(joint).ofPoint(joint.pivot);
            const torque = gravityHoldingTorque(axis, pivot, masses);
            const utilization = effortUtilization(torque, joint.maxEffort);
            console.log(
                `[torque] ${joint.name}: ${Math.abs(torque).toFixed(3)} N·m required, ` +
                    `rated ${joint.maxEffort} N·m` +
                    (Number.isFinite(utilization) ? ` (${(utilization * 100).toFixed(0)}%)` : " (unrated)"),
            );
            if (!peak || Math.abs(torque) > Math.abs(peak.torque)) {
                peak = { joint, torque, utilization };
            }
        }

        if (!peak) return;
        const util = Number.isFinite(peak.utilization) ? `${(peak.utilization * 100).toFixed(0)}` : "—";
        PubSub.default.pub(
            "showToast",
            "toast.measure.torque:{0}{1}{2}{3}",
            peak.joint.name,
            Math.abs(peak.torque).toFixed(3),
            util,
            `${peak.joint.maxEffort}`,
        );
    }

    // Every link in the joint's subtree becomes one point mass at its world centre of mass. A link's
    // own geometry only — nested links carry their own mass as separate entries — so the sum over the
    // subtree is the full load the joint holds.
    private downstreamPointMasses(joint: JointNode): PointMass[] {
        const links = NodeUtils.findNodes(joint, (n) => n instanceof LinkNode) as LinkNode[];
        const masses: PointMass[] = [];
        for (const link of links) {
            const center = linkWorldCenterOfMass(link);
            if (center) masses.push({ center, mass: link.mass });
        }
        return masses;
    }
}

// World transform of a node, composed from the ancestor chain (root-most first). Independent of the
// rendered visual context, so it works headlessly and for nodes that carry no visual.
function worldTransformOf(node: INode): Matrix4 {
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

// Volume-weighted centre of mass of a link's OWN solids, in world coordinates. Descends through
// folders/groups but stops at nested links/joints (their geometry belongs to them). Falls back to the
// link frame origin when the link has no solids (surface-only or empty link still carries its mass).
function linkWorldCenterOfMass(link: LinkNode): XYZ | undefined {
    let volume = 0;
    let x = 0;
    let y = 0;
    let z = 0;
    const walk = (parent: INodeLinkedList) => {
        let n = parent.firstChild;
        while (n) {
            if (!(n instanceof LinkNode || n instanceof JointNode)) {
                if (n instanceof ShapeNode && n.shape.isOk) {
                    const world = n.shape.value.transformedMul(worldTransformOf(n));
                    for (const sub of world.findSubShapes(ShapeTypes.solid)) {
                        const mp = (sub as ISolid).massProperties();
                        if (mp.volume > 1e-9) {
                            volume += mp.volume;
                            x += mp.centerOfMass.x * mp.volume;
                            y += mp.centerOfMass.y * mp.volume;
                            z += mp.centerOfMass.z * mp.volume;
                        }
                    }
                } else if (NodeUtils.isLinkedListNode(n)) {
                    walk(n);
                }
            }
            n = n.nextSibling;
        }
    };
    walk(link);
    if (volume <= 1e-9) return worldTransformOf(link).ofPoint(XYZ.zero);
    return new XYZ({ x: x / volume, y: y / volume, z: z / volume });
}
