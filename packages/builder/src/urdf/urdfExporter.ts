// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    BoundingBox,
    type IShape,
    type IShapeConverter,
    JointNode,
    LinkNode,
    MathUtils,
    ShapeNode,
    type VisualNode,
} from "@chili3d/core";

const MM_TO_M = 0.001;

export interface UrdfExport {
    urdf: string;
    meshes: Map<string, Uint8Array>;
}

export function exportUrdf(root: LinkNode, robotName: string, converter: IShapeConverter): UrdfExport {
    const meshes = new Map<string, Uint8Array>();
    const used = new Set<string>();
    const links: string[] = [];
    const joints: string[] = [];

    const sanitize = (name: string): string => {
        const base = name.replace(/[^A-Za-z0-9_]/g, "_") || "node";
        let n = base;
        let i = 1;
        while (used.has(n)) n = `${base}_${i++}`;
        used.add(n);
        return n;
    };

    const num = (v: number): string => (Math.abs(v) < 1e-9 ? "0" : `${+v.toFixed(4)}`);

    const jointXml = (joint: JointNode, parent: string, child: string): string => {
        // The joint's pivot is its location in the parent frame; the axis carries direction, so rpy
        // stays zero (the in-app joint model has no separate frame rotation).
        const t = joint.pivot;
        const xyz = `${num(t.x * MM_TO_M)} ${num(t.y * MM_TO_M)} ${num(t.z * MM_TO_M)}`;
        const rpy = "0 0 0";
        const a = joint.axis;
        const head =
            `  <joint name="${sanitize(joint.name)}" type="${joint.jointType}">\n` +
            `    <parent link="${parent}"/>\n    <child link="${child}"/>\n` +
            `    <origin xyz="${xyz}" rpy="${rpy}"/>\n`;
        // fixed and floating joints carry no axis or limit.
        if (joint.jointType === "fixed" || joint.jointType === "floating") return `${head}  </joint>`;

        const axis = `    <axis xyz="${num(a.x)} ${num(a.y)} ${num(a.z)}"/>\n`;
        const dynamics =
            joint.damping !== 0 || joint.friction !== 0
                ? `    <dynamics damping="${num(joint.damping)}" friction="${num(joint.friction)}"/>\n`
                : "";
        const angular = joint.jointType === "revolute" || joint.jointType === "continuous";
        const eff = num(joint.maxEffort);
        const vel = num(joint.maxVelocity);
        // continuous and planar joints have no position limits; the others export lower/upper.
        const limit =
            joint.jointType === "continuous" || joint.jointType === "planar"
                ? `    <limit effort="${eff}" velocity="${vel}"/>\n`
                : `    <limit lower="${num(angular ? MathUtils.degToRad(joint.lowerLimit) : joint.lowerLimit * MM_TO_M)}" ` +
                  `upper="${num(angular ? MathUtils.degToRad(joint.upperLimit) : joint.upperLimit * MM_TO_M)}" ` +
                  `effort="${eff}" velocity="${vel}"/>\n`;
        let mimic = "";
        if (joint.mimicJoint) {
            const master = joint.document.modelManager.findNode((n) => n.id === joint.mimicJoint);
            if (master) {
                const masterName = master.name.replace(/[^A-Za-z0-9_]/g, "_") || "node";
                mimic = `    <mimic joint="${masterName}" multiplier="${num(joint.mimicMultiplier)}" offset="${num(joint.mimicOffset)}"/>\n`;
            }
        }
        return `${head}${axis}${limit}${dynamics}${mimic}  </joint>`;
    };

    const walkLink = (link: LinkNode): string => {
        const linkName = sanitize(link.name);
        const shapes = collectLinkShapes(link);
        let body = "";
        if (shapes.length > 0) {
            const stl = converter.convertToSTL(shapes, { binary: true });
            if (stl.isOk) {
                const file = `${linkName}.stl`;
                meshes.set(file, stl.value);
                const meshTag = `<geometry><mesh filename="meshes/${file}" scale="0.001 0.001 0.001"/></geometry>`;
                body = `<visual>${meshTag}</visual><collision>${meshTag}</collision>${inertialXml(boundingBoxOf(shapes), link.mass)}`;
            }
        }
        links.push(`  <link name="${linkName}">${body}</link>`);

        for (const joint of childJoints(link)) {
            const childLink = childLinkOf(joint);
            if (!childLink) continue;
            const childName = walkLink(childLink);
            joints.push(jointXml(joint, linkName, childName));
        }
        return linkName;
    };

    walkLink(root);
    const urdf =
        `<?xml version="1.0"?>\n<robot name="${robotName.replace(/[^A-Za-z0-9_]/g, "_")}">\n` +
        `${links.join("\n")}\n${joints.join("\n")}\n</robot>\n`;
    return { urdf, meshes };
}

function collectLinkShapes(link: LinkNode): IShape[] {
    const shapes: IShape[] = [];
    let n = link.firstChild;
    while (n) {
        if (n instanceof ShapeNode && n.shape.isOk) {
            shapes.push(n.shape.value.transformedMul((n as VisualNode).transform));
        }
        n = n.nextSibling;
    }
    return shapes;
}

function childJoints(link: LinkNode): JointNode[] {
    const out: JointNode[] = [];
    let n = link.firstChild;
    while (n) {
        if (n instanceof JointNode) out.push(n);
        n = n.nextSibling;
    }
    return out;
}

function childLinkOf(joint: JointNode): LinkNode | undefined {
    let n = joint.firstChild;
    while (n) {
        if (n instanceof LinkNode) return n;
        n = n.nextSibling;
    }
    return undefined;
}

function boundingBoxOf(shapes: IShape[]): BoundingBox | undefined {
    let box: BoundingBox | undefined;
    for (const s of shapes) {
        box = BoundingBox.combine(box, s.boundingBox());
    }
    return box;
}

function inertialXml(box: BoundingBox | undefined, mass: number): string {
    const dx = (box ? box.max.x - box.min.x : 1) * MM_TO_M || 0.001;
    const dy = (box ? box.max.y - box.min.y : 1) * MM_TO_M || 0.001;
    const dz = (box ? box.max.z - box.min.z : 1) * MM_TO_M || 0.001;
    const ixx = (mass / 12) * (dy * dy + dz * dz);
    const iyy = (mass / 12) * (dx * dx + dz * dz);
    const izz = (mass / 12) * (dx * dx + dy * dy);
    const f = (v: number) => `${+v.toFixed(8)}`;
    return (
        `<inertial><mass value="${mass}"/>` +
        `<inertia ixx="${f(ixx)}" ixy="0" ixz="0" iyy="${f(iyy)}" iyz="0" izz="${f(izz)}"/></inertial>`
    );
}
