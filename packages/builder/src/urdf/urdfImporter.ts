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
            origin: parseOrigin(el.querySelector("origin")),
        });
        const angular = type === "revolute" || type === "continuous";
        const limit = el.querySelector("limit");
        if (limit) {
            const lo = Number(limit.getAttribute("lower") ?? "0");
            const hi = Number(limit.getAttribute("upper") ?? "0");
            joint.lowerLimit = angular ? MathUtils.radToDeg(lo) : lo * M_TO_MM;
            joint.upperLimit = angular ? MathUtils.radToDeg(hi) : hi * M_TO_MM;
        }
        joint.add(child);
        parent.add(joint);
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

function parseOrigin(el: Element | null): Matrix4 {
    const xyz = (el?.getAttribute("xyz") ?? "0 0 0").trim().split(/\s+/).map(Number);
    const rpy = (el?.getAttribute("rpy") ?? "0 0 0").trim().split(/\s+/).map(Number);
    const t = Matrix4.fromTranslation(
        (xyz[0] ?? 0) * M_TO_MM,
        (xyz[1] ?? 0) * M_TO_MM,
        (xyz[2] ?? 0) * M_TO_MM,
    );
    const [roll, pitch, yaw] = [rpy[0] ?? 0, rpy[1] ?? 0, rpy[2] ?? 0];
    if (roll === 0 && pitch === 0 && yaw === 0) return t;
    // URDF rpy = "roll pitch yaw" (fixed-axis Rz·Ry·Rx). Matrix4.multiply applies `this` first,
    // so rpyToMatrix(...).multiply(t) = t·R (standard) — translate the rotated frame.
    return rpyToMatrix(roll, pitch, yaw).multiply(t);
}
