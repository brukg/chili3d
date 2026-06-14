// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    BoundingBox,
    type INode,
    type INodeLinkedList,
    type IShape,
    type IShapeConverter,
    JointNode,
    LinkNode,
    MathUtils,
    Matrix4,
    NodeUtils,
    ShapeNode,
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

// A nested Link or Joint starts its own body/articulation in the kinematic tree, so when gathering a
// link's own contents we descend through organizational folders/groups but never cross those.
function isStructuralBoundary(node: INode): boolean {
    return node instanceof LinkNode || node instanceof JointNode;
}

// The node's local placement, if it carries one (VisualNode and GroupNode both do).
function nodeTransform(node: INode): Matrix4 | undefined {
    const transform = (node as { transform?: unknown }).transform;
    return transform instanceof Matrix4 ? transform : undefined;
}

// Collect every shape belonging to this link, recursing into nested folders/groups and composing
// each group's transform so geometry organised under folders exports at the right place. Without the
// recursion, a link whose meshes are tucked inside a folder would export with no geometry at all.
function collectLinkShapes(link: LinkNode): IShape[] {
    const shapes: IShape[] = [];
    const walk = (parent: INodeLinkedList, parentTransform: Matrix4) => {
        let n = parent.firstChild;
        while (n) {
            if (!isStructuralBoundary(n)) {
                const local = nodeTransform(n);
                const transform = local ? parentTransform.multiply(local) : parentTransform;
                if (n instanceof ShapeNode && n.shape.isOk) {
                    shapes.push(n.shape.value.transformedMul(transform));
                } else if (NodeUtils.isLinkedListNode(n)) {
                    walk(n, transform);
                }
            }
            n = n.nextSibling;
        }
    };
    walk(link, Matrix4.identity());
    return shapes;
}

// Joints attached to this link, found through any nesting folders but stopping at a nested link
// (whose joints belong to it, not to us).
function childJoints(link: LinkNode): JointNode[] {
    const out: JointNode[] = [];
    const walk = (parent: INodeLinkedList) => {
        let n = parent.firstChild;
        while (n) {
            if (n instanceof JointNode) {
                out.push(n);
            } else if (!(n instanceof LinkNode) && NodeUtils.isLinkedListNode(n)) {
                walk(n);
            }
            n = n.nextSibling;
        }
    };
    walk(link);
    return out;
}

// The child link a joint drives, found through any nesting folders.
function childLinkOf(joint: JointNode): LinkNode | undefined {
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
