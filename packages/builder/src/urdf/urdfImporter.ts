// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    GeometryNode,
    type IDocument,
    type INode,
    type IShapeConverter,
    JointNode,
    type JointType,
    LinkNode,
    Material,
    MathUtils,
    Matrix4,
    NodeUtils,
    XYZ,
} from "@chili3d/core";
import { rpyToMatrix } from "./urdfMath";

const M_TO_MM = 1000;

export function importUrdf(
    urdf: string,
    meshes: Map<string, Uint8Array>,
    document: IDocument,
    converter: IShapeConverter,
): LinkNode | undefined {
    const xml = new DOMParser().parseFromString(urdf, "application/xml");
    const robot = xml.querySelector("robot");
    if (!robot) return undefined;

    const direct = (tag: string) => Array.from(robot.children).filter((c) => c.tagName.toLowerCase() === tag);
    const materialsByName = new Map<string, Material>();

    const links = new Map<string, LinkNode>();
    for (const el of direct("link")) {
        const name = el.getAttribute("name") ?? "link";
        const link = new LinkNode({ document, name });
        const massEl = el.querySelector("inertial mass");
        if (massEl) link.mass = Number(massEl.getAttribute("value") ?? "1");
        importInertia(el, link);

        const material = linkMaterial(el, document, materialsByName);
        const visualFiles = new Set<string>();
        // Import every <visual>, not just the first — a link can carry several meshes.
        for (const visual of Array.from(el.querySelectorAll("visual"))) {
            const filename = visual.querySelector("mesh")?.getAttribute("filename");
            if (!filename) continue;
            const file = filename.split("/").pop() ?? filename;
            visualFiles.add(file);
            const bytes = meshes.get(file);
            if (!bytes) continue;
            const result = converter.convertFromSTL(document, bytes);
            if (!result.isOk) continue;
            const geom = result.value;
            // Place the geometry at the visual's <origin> (URDF metres → app millimetres) and paint
            // it with the link's material — both applied to the geometry nodes, as the imported
            // FolderNode container itself carries no transform.
            const origin = visual.querySelector("origin");
            decorate(geom, origin ? originMatrix(origin) : undefined, material?.id);
            link.add(geom);
        }

        link.collisionGeometry = detectCollisionMode(el, visualFiles);
        links.set(name, link);
    }

    const childNames = new Set<string>();
    const joints = new Map<string, JointNode>(); // by URDF joint name, for mimic resolution
    for (const el of direct("joint")) {
        const name = el.getAttribute("name") ?? "joint";
        const type = (el.getAttribute("type") ?? "fixed") as JointType;
        const parent = links.get(el.querySelector("parent")?.getAttribute("link") ?? "");
        const child = links.get(el.querySelector("child")?.getAttribute("link") ?? "");
        if (!parent || !child) continue;
        childNames.add(child.name);

        const origin = el.querySelector("origin");
        const joint = new JointNode({
            document,
            name,
            jointType: type,
            axis: parseVec(el.querySelector("axis")?.getAttribute("xyz"), 0, 0, 1),
            pivot: parsePivot(origin),
            orientation: parseOrientation(origin),
        });
        const angular = type === "revolute" || type === "continuous";
        const limit = el.querySelector("limit");
        if (limit) {
            const lo = Number(limit.getAttribute("lower") ?? "0");
            const hi = Number(limit.getAttribute("upper") ?? "0");
            joint.lowerLimit = angular ? MathUtils.radToDeg(lo) : lo * M_TO_MM;
            joint.upperLimit = angular ? MathUtils.radToDeg(hi) : hi * M_TO_MM;
            const effort = limit.getAttribute("effort");
            const velocity = limit.getAttribute("velocity");
            if (effort !== null) joint.maxEffort = Number(effort);
            if (velocity !== null) joint.maxVelocity = Number(velocity);
        }
        const dynamics = el.querySelector("dynamics");
        if (dynamics) {
            joint.damping = Number(dynamics.getAttribute("damping") ?? "0");
            joint.friction = Number(dynamics.getAttribute("friction") ?? "0");
        }
        joint.add(child);
        parent.add(joint);
        joints.set(name, joint);
    }

    // Second pass: resolve <mimic> now that every joint exists. URDF references the master by joint
    // name; the model stores the master's id (subscribeMimic wires the live link after the tree mounts).
    for (const el of direct("joint")) {
        const mimic = el.querySelector("mimic");
        const joint = joints.get(el.getAttribute("name") ?? "");
        const master = joints.get(mimic?.getAttribute("joint") ?? "");
        if (!joint || !master) continue;
        joint.mimicMultiplier = Number(mimic?.getAttribute("multiplier") ?? "1");
        joint.mimicOffset = Number(mimic?.getAttribute("offset") ?? "0");
        joint.mimicJoint = master.id;
    }

    // Transmissions: carry each SimpleTransmission's mechanical reduction back onto its joint's gear
    // ratio so an exported gearbox survives a round-trip.
    for (const el of direct("transmission")) {
        const jointName = el.querySelector("joint")?.getAttribute("name") ?? "";
        const reduction = el.querySelector("mechanicalReduction")?.textContent;
        const joint = joints.get(jointName);
        if (joint && reduction && reduction.trim() !== "") joint.gearRatio = Number(reduction);
    }

    for (const [name, link] of links) {
        if (!childNames.has(name)) return link;
    }
    return undefined;
}

function parseVec(s: string | null | undefined, dx: number, dy: number, dz: number): XYZ {
    if (!s) return new XYZ({ x: dx, y: dy, z: dz });
    const p = s.trim().split(/\s+/).map(Number);
    return new XYZ({ x: p[0] ?? dx, y: p[1] ?? dy, z: p[2] ?? dz });
}

// The joint pivot is the URDF origin's location (m → mm).
function parsePivot(el: Element | null): XYZ {
    const xyz = (el?.getAttribute("xyz") ?? "0 0 0").trim().split(/\s+/).map(Number);
    return new XYZ({
        x: (xyz[0] ?? 0) * M_TO_MM,
        y: (xyz[1] ?? 0) * M_TO_MM,
        z: (xyz[2] ?? 0) * M_TO_MM,
    });
}

// The joint orientation is the URDF origin's rpy (radians) stored as the model's degrees triple.
function parseOrientation(el: Element | null): XYZ {
    const rpy = (el?.getAttribute("rpy") ?? "0 0 0").trim().split(/\s+/).map(Number);
    return new XYZ({
        x: MathUtils.radToDeg(rpy[0] ?? 0),
        y: MathUtils.radToDeg(rpy[1] ?? 0),
        z: MathUtils.radToDeg(rpy[2] ?? 0),
    });
}

// Preserve an explicit <inertial> (full tensor + COM) so a hand-authored URDF inertia survives a
// round-trip; without an <inertia> element the link keeps the default geometry-computed inertia.
function importInertia(linkEl: Element, link: LinkNode): void {
    const inertia = linkEl.querySelector("inertial inertia");
    if (!inertia) return;
    const n = (attr: string) => Number(inertia.getAttribute(attr) ?? "0");
    const origin = linkEl.querySelector("inertial origin");
    const xyz = (origin?.getAttribute("xyz") ?? "0 0 0").trim().split(/\s+/).map(Number);
    link.inertialCenter = new XYZ({
        x: (xyz[0] ?? 0) * M_TO_MM,
        y: (xyz[1] ?? 0) * M_TO_MM,
        z: (xyz[2] ?? 0) * M_TO_MM,
    });
    link.momentOfInertia = new XYZ({ x: n("ixx"), y: n("iyy"), z: n("izz") });
    link.productOfInertia = new XYZ({ x: n("ixy"), y: n("ixz"), z: n("iyz") });
    link.overrideInertia = true;
}

// A visual/collision <origin> as an app transform: rotate by rpy, then translate (m → mm). rpyToMatrix
// already produces the row-vector form chili3d's Matrix4 uses, so this composes left-to-right.
function originMatrix(el: Element): Matrix4 {
    const xyz = (el.getAttribute("xyz") ?? "0 0 0").trim().split(/\s+/).map(Number);
    const rpy = (el.getAttribute("rpy") ?? "0 0 0").trim().split(/\s+/).map(Number);
    const rotation = rpyToMatrix(rpy[0] ?? 0, rpy[1] ?? 0, rpy[2] ?? 0);
    const translation = Matrix4.fromTranslation(
        (xyz[0] ?? 0) * M_TO_MM,
        (xyz[1] ?? 0) * M_TO_MM,
        (xyz[2] ?? 0) * M_TO_MM,
    );
    return rotation.multiply(translation);
}

// Create (once per name) the link's material from its <material><color rgba>, and register it.
function linkMaterial(
    linkEl: Element,
    document: IDocument,
    cache: Map<string, Material>,
): Material | undefined {
    const materialEl = linkEl.querySelector("visual material");
    const rgba = materialEl?.querySelector("color")?.getAttribute("rgba");
    if (!materialEl || !rgba) return undefined;
    const name = materialEl.getAttribute("name") || "urdf_material";
    const existing = cache.get(name);
    if (existing) return existing;

    const [r, g, b, a] = rgba.trim().split(/\s+/).map(Number);
    const color = ((clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b)) >>> 0;
    const material = new Material({ document, name, color });
    material.opacity = a ?? 1;
    document.modelManager.materials.push(material);
    cache.set(name, material);
    return material;
}

function clampByte(v: number): number {
    return Math.max(0, Math.min(255, Math.round((Number.isFinite(v) ? v : 0) * 255)));
}

// Apply a placement transform and/or a material id to every geometry node in an imported subtree
// (the FolderNode container has no transform of its own, so it is pushed onto the leaf geometry).
function decorate(node: INode, transform: Matrix4 | undefined, materialId: string | undefined): void {
    if (node instanceof GeometryNode) {
        if (transform) node.transform = node.transform.multiply(transform);
        if (materialId) node.materialId = materialId;
    }
    if (NodeUtils.isLinkedListNode(node)) {
        let child = node.firstChild;
        while (child) {
            decorate(child, transform, materialId);
            child = child.nextSibling;
        }
    }
}

// Infer the collision authoring mode from the URDF so a re-export keeps the same kind of collider:
// a <box> primitive → "box"; a mesh that is the same file as the visual → "mesh"; otherwise (a
// dedicated collision mesh, e.g. *_collision.stl) → "convex".
function detectCollisionMode(linkEl: Element, visualFiles: Set<string>): "convex" | "box" | "mesh" {
    const collision = linkEl.querySelector("collision");
    if (!collision) return "convex";
    if (collision.querySelector("box")) return "box";
    const filename = collision.querySelector("mesh")?.getAttribute("filename");
    if (filename) {
        const file = filename.split("/").pop() ?? filename;
        if (visualFiles.has(file)) return "mesh";
    }
    return "convex";
}
