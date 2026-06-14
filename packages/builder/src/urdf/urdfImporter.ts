// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type IDocument,
    type IShapeConverter,
    JointNode,
    type JointType,
    LinkNode,
    MathUtils,
    Matrix4,
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

    const links = new Map<string, LinkNode>();
    for (const el of direct("link")) {
        const name = el.getAttribute("name") ?? "link";
        const link = new LinkNode({ document, name });
        const massEl = el.querySelector("inertial mass");
        if (massEl) link.mass = Number(massEl.getAttribute("value") ?? "1");
        const filename = el.querySelector("visual mesh")?.getAttribute("filename");
        if (filename) {
            const file = filename.split("/").pop() ?? filename;
            const bytes = meshes.get(file);
            if (bytes) {
                const result = converter.convertFromSTL(document, bytes);
                if (result.isOk) link.add(result.value);
            }
        }
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

        const joint = new JointNode({
            document,
            name,
            jointType: type,
            axis: parseVec(el.querySelector("axis")?.getAttribute("xyz"), 0, 0, 1),
            pivot: parsePivot(el.querySelector("origin")),
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

// The joint pivot is the URDF origin's location (m → mm). The pivot model carries no frame
// rotation, so rpy is ignored on import.
function parsePivot(el: Element | null): XYZ {
    const xyz = (el?.getAttribute("xyz") ?? "0 0 0").trim().split(/\s+/).map(Number);
    return new XYZ({
        x: (xyz[0] ?? 0) * M_TO_MM,
        y: (xyz[1] ?? 0) * M_TO_MM,
        z: (xyz[2] ?? 0) * M_TO_MM,
    });
}
