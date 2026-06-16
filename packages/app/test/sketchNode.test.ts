// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
    type IApplication,
    Plane,
    type Point2d,
    type SketchConstraint,
    setCurrentApplication,
    solveConstraints,
    toConstraint,
    XYZ,
} from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { beforeAll, describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { SketchNode } from "../src/bodys/sketchNode";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Four corners, deliberately off-square so the solver has work to do.
const points: Point2d[] = [
    { x: 0.3, y: -0.2 }, // 0
    { x: 9.7, y: 0.4 }, // 1
    { x: 10.2, y: 9.6 }, // 2
    { x: -0.1, y: 10.3 }, // 3
];
const constraints: SketchConstraint[] = [
    { type: "fixed", point: 0, x: 0, y: 0 },
    { type: "horizontal", a: 0, b: 1 },
    { type: "distance", a: 0, b: 1, d: 10 },
    { type: "vertical", a: 0, b: 3 },
    { type: "distance", a: 0, b: 3, d: 10 },
    { type: "horizontal", a: 3, b: 2 },
    { type: "vertical", a: 1, b: 2 },
];

describe("SketchNode (C4 — constraint solver → geometry)", () => {
    beforeAll(async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        setCurrentApplication({ shapeFactory: new ShapeFactory() } as unknown as IApplication);
    });

    test("generates a wire whose bounding box is ~10x10", () => {
        const doc = new TestDocument() as any;
        const node = new SketchNode({ document: doc, plane: Plane.XY, points, constraints });
        doc.modelManager.rootNode.add(node);

        const result = node.generateShape();
        expect(result.isOk).toBe(true);

        const box = result.value.boundingBox();
        expect(box.max.x - box.min.x).toBeCloseTo(10, 3);
        expect(box.max.y - box.min.y).toBeCloseTo(10, 3);
    });

    test("the solved corner distances confirm a 10x10 square (C4 proof)", () => {
        const live = solveConstraints(
            points,
            constraints.map((c) => toConstraint(c)),
        );
        expect(live.converged).toBe(true);
        const d = (a: number, b: number) =>
            Math.hypot(live.points[a].x - live.points[b].x, live.points[a].y - live.points[b].y);
        expect(d(0, 1)).toBeCloseTo(10, 6);
        expect(d(0, 3)).toBeCloseTo(10, 6);
        expect(d(1, 2)).toBeCloseTo(10, 6);
        expect(d(3, 2)).toBeCloseTo(10, 6);
    });

    test("constraintStatus reports remaining degrees of freedom", () => {
        const doc = new TestDocument() as any;
        const pts: Point2d[] = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];
        // Only one point pinned → 6 of the 8 coordinates are still free.
        const partial: SketchConstraint[] = [{ type: "fixed", point: 0, x: 0, y: 0 }];
        expect(SketchNode.describeStatus(pts, partial, doc)).toBe("Under-constrained (6 DoF)");

        // Pin every point → fully defined.
        const full: SketchConstraint[] = pts.map((p, i) => ({ type: "fixed", point: i, x: p.x, y: p.y }));
        expect(SketchNode.describeStatus(pts, full, doc)).toBe("Fully constrained");
    });

    test("nearestPointIndex maps a plane point to the closest sketch corner", () => {
        const doc = new TestDocument() as any;
        const node = new SketchNode({ document: doc, plane: Plane.XY, points, constraints });
        // On Plane.XY a plane point's (x, y) are its (u, v); the square solves to corners at
        // (0,0) (10,0) (10,10) (0,10) — so a probe near each corner resolves to that index.
        expect(node.nearestPointIndex(new XYZ({ x: 0.1, y: 0.1, z: 0 }))).toBe(0);
        expect(node.nearestPointIndex(new XYZ({ x: 9.9, y: 0.1, z: 0 }))).toBe(1);
        expect(node.nearestPointIndex(new XYZ({ x: 9.9, y: 9.9, z: 0 }))).toBe(2);
        expect(node.nearestPointIndex(new XYZ({ x: 0.1, y: 9.9, z: 0 }))).toBe(3);
    });

    test("an angle constraint solves a segment to the requested angle (90°)", () => {
        const doc = new TestDocument() as any;
        // Base segment 0→1 along +X; segment 0→2 starts skew and is constrained to 90° from it.
        const node = new SketchNode({
            document: doc,
            plane: Plane.XY,
            points: [
                { x: 0, y: 0 }, // 0
                { x: 10, y: 0 }, // 1
                { x: 3, y: 4 }, // 2 (skew, will be rotated to +Y by the constraint)
            ],
            constraints: [
                { type: "fixed", point: 0, x: 0, y: 0 },
                { type: "fixed", point: 1, x: 10, y: 0 },
                { type: "distance", a: 0, b: 2, d: 5 },
                { type: "angle", a: 0, b: 1, c: 0, d: 2, radians: Math.PI / 2 },
            ],
        });
        const solved = node.solvedPoints();
        // Segment 0→2 is now perpendicular to 0→1 (the +X axis): its x-component collapses to ~0.
        expect(solved[2].x).toBeCloseTo(0, 4);
        expect(Math.abs(solved[2].y)).toBeCloseTo(5, 4);
    });

    test("a point-on-line constraint pulls a point onto the segment's line", () => {
        const doc = new TestDocument() as any;
        // Segment 0→1 lies on the X axis; point 2 starts above it and is constrained on-line.
        const node = new SketchNode({
            document: doc,
            plane: Plane.XY,
            points: [
                { x: 0, y: 0 }, // 0
                { x: 10, y: 0 }, // 1
                { x: 5, y: 4 }, // 2 (off the line; should drop to y≈0)
            ],
            constraints: [
                { type: "fixed", point: 0, x: 0, y: 0 },
                { type: "fixed", point: 1, x: 10, y: 0 },
                { type: "distanceX", a: 0, b: 2, dx: 5 },
                { type: "pointOnLine", point: 2, a: 0, b: 1 },
            ],
        });
        const solved = node.solvedPoints();
        expect(solved[2].y).toBeCloseTo(0, 5);
        expect(solved[2].x).toBeCloseTo(5, 5);
    });

    test("addConstraint re-solves: pinning a free corner fully constrains the sketch", () => {
        const doc = new TestDocument() as any;
        // A single fixed point leaves 6 DoF; adding constraints drives the sketch toward defined.
        const node = new SketchNode({
            document: doc,
            plane: Plane.XY,
            points: [
                { x: 0, y: 0 },
                { x: 9.7, y: 0.3 },
            ],
            constraints: [{ type: "fixed", point: 0, x: 0, y: 0 }],
        });
        doc.modelManager.rootNode.add(node);
        expect(node.constraints.length).toBe(1);

        node.addConstraint({ type: "horizontal", a: 0, b: 1 });
        node.addConstraint({ type: "fixed", point: 1, x: 10, y: 0 });
        expect(node.constraints.length).toBe(3);
        // Point 1 was pulled onto the x-axis at x=10.
        const solved = node.solvedPoints();
        expect(solved[1].x).toBeCloseTo(10, 6);
        expect(solved[1].y).toBeCloseTo(0, 6);
    });
});
