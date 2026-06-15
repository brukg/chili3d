// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    BoundingBox,
    GeometryNode,
    type INode,
    type INodeLinkedList,
    type IShape,
    type IShapeConverter,
    type ISolid,
    JointNode,
    LinkNode,
    type Material,
    MathUtils,
    Matrix4,
    NodeUtils,
    ShapeNode,
    ShapeTypes,
} from "@chili3d/core";

const MM_TO_M = 0.001;

// Format a number for URDF: snap near-zero to "0", otherwise 4 decimal places.
const num = (v: number): string => (Math.abs(v) < 1e-9 ? "0" : `${+v.toFixed(4)}`);

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
                const box = boundingBoxOf(shapes);
                const material = materialXml(link, linkName);
                const collision = collisionXml(link, box, meshTag);
                body = `<visual>${meshTag}${material}</visual>${collision}${inertialXml(shapes, box, link.mass)}`;
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

// Collision geometry. Default (`box`) emits the link's axis-aligned bounding box as a primitive — the
// cheap, stable collider every physics engine prefers — placed at the box centre. `mesh` reuses the
// exact visual mesh (accurate but slow/unstable in collision checking). If there is no box to size a
// primitive from, fall back to the mesh so collision is never silently absent.
function collisionXml(link: LinkNode, box: BoundingBox | undefined, meshTag: string): string {
    if (link.collisionGeometry === "mesh" || !box) return `<collision>${meshTag}</collision>`;
    // A zero-thickness collider is invalid in every physics engine; floor each dimension at 1 mm.
    const sx = num(Math.max((box.max.x - box.min.x) * MM_TO_M, 0.001));
    const sy = num(Math.max((box.max.y - box.min.y) * MM_TO_M, 0.001));
    const sz = num(Math.max((box.max.z - box.min.z) * MM_TO_M, 0.001));
    const cx = num(((box.max.x + box.min.x) / 2) * MM_TO_M);
    const cy = num(((box.max.y + box.min.y) / 2) * MM_TO_M);
    const cz = num(((box.max.z + box.min.z) / 2) * MM_TO_M);
    return (
        `<collision><origin xyz="${cx} ${cy} ${cz}" rpy="0 0 0"/>` +
        `<geometry><box size="${sx} ${sy} ${sz}"/></geometry></collision>`
    );
}

// `<material>` inside `<visual>`, derived from the colour of the link's first materialled geometry so
// the robot keeps its appearance in RViz/Gazebo. URDF allows an inline material definition per link.
function materialXml(link: LinkNode, linkName: string): string {
    const material = linkMaterial(link);
    if (!material) return "";
    const [r, g, b] = colorToRgb(material.color);
    const a = +(material.opacity ?? 1).toFixed(4);
    return (
        `<material name="${linkName}_material">` +
        `<color rgba="${+r.toFixed(4)} ${+g.toFixed(4)} ${+b.toFixed(4)} ${a}"/></material>`
    );
}

// The first geometry under the link (descending through folders, stopping at the next link/joint)
// that resolves to a document material — the link's representative colour.
function linkMaterial(link: LinkNode): Material | undefined {
    const materials = link.document.modelManager.materials;
    const find = (parent: INodeLinkedList): Material | undefined => {
        let n = parent.firstChild;
        while (n) {
            if (!isStructuralBoundary(n)) {
                if (n instanceof GeometryNode) {
                    const id = Array.isArray(n.materialId) ? n.materialId[0] : n.materialId;
                    if (id) {
                        for (const m of materials) if (m.id === id) return m;
                    }
                } else if (NodeUtils.isLinkedListNode(n)) {
                    const found = find(n);
                    if (found) return found;
                }
            }
            n = n.nextSibling;
        }
        return undefined;
    };
    return find(link);
}

// A material colour (hex number like 0xRRGGBB, or a "#rrggbb" string) as normalised r,g,b in [0,1].
function colorToRgb(color: number | string): [number, number, number] {
    let value: number;
    if (typeof color === "number") {
        value = color;
    } else {
        const hex = color.replace("#", "");
        const full = hex.length === 3 ? hex.replace(/(.)/g, "$1$1") : hex;
        value = Number.parseInt(full || "0", 16);
    }
    if (!Number.isFinite(value)) value = 0;
    return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}

// Real inertial properties from the link's solids: true volume-weighted centre of mass and the
// inertia tensor about that COM (OCCT's GProp returns each solid's inertia about its OWN COM, so we
// parallel-axis-shift each to the combined COM, then scale unit-density values to the link mass). Far
// more accurate than a bounding-box box, and emits the `<origin>` so the COM is not assumed at the
// link frame. Falls back to a box approximation when the link has no solids (e.g. surface-only geom).
function inertialXml(shapes: IShape[], box: BoundingBox | undefined, mass: number): string {
    const mp = combinedMassProps(shapes);
    if (!mp) return boxInertialXml(box, mass);

    // unit-density inertia (mm^5) -> kg·m²: multiply by density (mass/volume, kg/mm³) and mm²->m².
    const k = (mass / mp.volume) * MM_TO_M * MM_TO_M;
    const floor = 1e-9; // never emit a degenerate/zero inertia for a real body.
    const ixx = Math.max(mp.ixx * k, floor);
    const iyy = Math.max(mp.iyy * k, floor);
    const izz = Math.max(mp.izz * k, floor);
    const ox = num(mp.cx * MM_TO_M);
    const oy = num(mp.cy * MM_TO_M);
    const oz = num(mp.cz * MM_TO_M);
    const f = (v: number) => `${+v.toFixed(8)}`;
    return (
        `<inertial><origin xyz="${ox} ${oy} ${oz}" rpy="0 0 0"/><mass value="${mass}"/>` +
        `<inertia ixx="${f(ixx)}" ixy="0" ixz="0" iyy="${f(iyy)}" iyz="0" izz="${f(izz)}"/></inertial>`
    );
}

interface CombinedMass {
    volume: number;
    cx: number;
    cy: number;
    cz: number;
    // inertia tensor diagonal about the combined COM, unit density (mm^5).
    ixx: number;
    iyy: number;
    izz: number;
}

function combinedMassProps(shapes: IShape[]): CombinedMass | undefined {
    const solids: ISolid[] = [];
    for (const s of shapes) {
        for (const sub of s.findSubShapes(ShapeTypes.solid)) solids.push(sub as ISolid);
    }
    if (solids.length === 0) return undefined;

    const props = solids.map((s) => s.massProperties());
    let volume = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const p of props) {
        volume += p.volume;
        cx += p.volume * p.centerOfMass.x;
        cy += p.volume * p.centerOfMass.y;
        cz += p.volume * p.centerOfMass.z;
    }
    if (volume <= 1e-9) return undefined;
    cx /= volume;
    cy /= volume;
    cz /= volume;

    let ixx = 0;
    let iyy = 0;
    let izz = 0;
    for (const p of props) {
        // parallel-axis shift from each solid's own COM to the combined COM (add m·d²).
        const dx = p.centerOfMass.x - cx;
        const dy = p.centerOfMass.y - cy;
        const dz = p.centerOfMass.z - cz;
        ixx += p.momentOfInertia.x + p.volume * (dy * dy + dz * dz);
        iyy += p.momentOfInertia.y + p.volume * (dx * dx + dz * dz);
        izz += p.momentOfInertia.z + p.volume * (dx * dx + dy * dy);
    }
    return { volume, cx, cy, cz, ixx, iyy, izz };
}

// Fallback for links with no solids: treat the bounding box as a uniform box about its centre.
function boxInertialXml(box: BoundingBox | undefined, mass: number): string {
    const dx = (box ? box.max.x - box.min.x : 1) * MM_TO_M || 0.001;
    const dy = (box ? box.max.y - box.min.y : 1) * MM_TO_M || 0.001;
    const dz = (box ? box.max.z - box.min.z : 1) * MM_TO_M || 0.001;
    const ixx = (mass / 12) * (dy * dy + dz * dz);
    const iyy = (mass / 12) * (dx * dx + dz * dz);
    const izz = (mass / 12) * (dx * dx + dy * dy);
    const ox = box ? num(((box.max.x + box.min.x) / 2) * MM_TO_M) : "0";
    const oy = box ? num(((box.max.y + box.min.y) / 2) * MM_TO_M) : "0";
    const oz = box ? num(((box.max.z + box.min.z) / 2) * MM_TO_M) : "0";
    const f = (v: number) => `${+v.toFixed(8)}`;
    return (
        `<inertial><origin xyz="${ox} ${oy} ${oz}" rpy="0 0 0"/><mass value="${mass}"/>` +
        `<inertia ixx="${f(ixx)}" ixy="0" ixz="0" iyy="${f(iyy)}" iyz="0" izz="${f(izz)}"/></inertial>`
    );
}
