// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
    type IApplication,
    type IFace,
    type IWire,
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

    test("bulged segments turn a 2-point sketch into a full circle (area π·r²)", () => {
        const doc = new TestDocument() as any;
        // Two points 10 apart, both segments bulged by 1 (semicircles on opposite sides) → a circle
        // of diameter 10. This exercises the arc-segment build path added to generateShape.
        const node = new SketchNode({
            document: doc,
            plane: Plane.XY,
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ],
            constraints: [
                { type: "fixed", point: 0, x: 0, y: 0 },
                { type: "fixed", point: 1, x: 10, y: 0 },
            ],
            bulges: [1, 1],
        });
        const shape = node.generateShape();
        expect(shape.isOk).toBe(true);

        const factory = new ShapeFactory();
        const face = factory.face([shape.value as IWire]);
        expect(face.isOk).toBe(true);
        // radius 5 → area π·25 ≈ 78.54 mm².
        expect((face.value as IFace).area()).toBeCloseTo(Math.PI * 25, 1);
    });

    test("a slot (two sides + bulged end caps) has area L·2r + π·r²", () => {
        const doc = new TestDocument() as any;
        // The construction the Sketch Slot command emits: length 20, radius 5.
        const node = new SketchNode({
            document: doc,
            plane: Plane.XY,
            points: [
                { x: 0, y: 5 },
                { x: 20, y: 5 },
                { x: 20, y: -5 },
                { x: 0, y: -5 },
            ],
            constraints: [
                { type: "fixed", point: 0, x: 0, y: 5 },
                { type: "fixed", point: 1, x: 20, y: 5 },
                { type: "fixed", point: 2, x: 20, y: -5 },
                { type: "fixed", point: 3, x: 0, y: -5 },
            ],
            bulges: [0, 1, 0, 1],
        });
        const shape = node.generateShape();
        expect(shape.isOk).toBe(true);

        const factory = new ShapeFactory();
        const face = factory.face([shape.value as IWire]);
        expect(face.isOk).toBe(true);
        // central rectangle 20×10 + two semicircles (= one circle r=5): 200 + 25π ≈ 278.54 mm².
        expect((face.value as IFace).area()).toBeCloseTo(200 + 25 * Math.PI, 1);
    });

    test("a regular hexagon sketch has area ½·N·r²·sin(2π/N)", () => {
        const doc = new TestDocument() as any;
        const n = 6;
        const r = 10;
        const pts: Point2d[] = Array.from({ length: n }, (_, k) => {
            const a = (2 * Math.PI * k) / n;
            return { x: r * Math.cos(a), y: r * Math.sin(a) };
        });
        const node = new SketchNode({
            document: doc,
            plane: Plane.XY,
            points: pts,
            constraints: pts.map((p, i) => ({ type: "fixed", point: i, x: p.x, y: p.y })),
        });
        const shape = node.generateShape();
        expect(shape.isOk).toBe(true);

        const factory = new ShapeFactory();
        const face = factory.face([shape.value as IWire]);
        expect(face.isOk).toBe(true);
        // Regular hexagon, r=10: ½·6·100·sin(60°) ≈ 259.81 mm².
        expect((face.value as IFace).area()).toBeCloseTo(0.5 * n * r * r * Math.sin((2 * Math.PI) / n), 1);
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

    test("the Sketch Rectangle constraint set solves to an exact 30x20 rectangle", () => {
        const doc = new TestDocument() as any;
        // The constraints the Sketch Rectangle command emits for corners dragged to (30, 20),
        // starting from deliberately skewed initial points so the solver must do the work.
        const node = new SketchNode({
            document: doc,
            plane: Plane.XY,
            points: [
                { x: 1, y: -1 },
                { x: 28, y: 2 },
                { x: 31, y: 19 },
                { x: -2, y: 22 },
            ],
            constraints: [
                { type: "fixed", point: 0, x: 0, y: 0 },
                { type: "horizontal", a: 0, b: 1 },
                { type: "horizontal", a: 3, b: 2 },
                { type: "vertical", a: 0, b: 3 },
                { type: "vertical", a: 1, b: 2 },
                { type: "distanceX", a: 0, b: 1, dx: 30 },
                { type: "distanceY", a: 0, b: 3, dy: 20 },
            ],
        });
        const p = node.solvedPoints();
        expect(p[0].x).toBeCloseTo(0, 5);
        expect(p[0].y).toBeCloseTo(0, 5);
        expect(p[1].x).toBeCloseTo(30, 5);
        expect(p[1].y).toBeCloseTo(0, 5);
        expect(p[2].x).toBeCloseTo(30, 5);
        expect(p[2].y).toBeCloseTo(20, 5);
        expect(p[3].x).toBeCloseTo(0, 5);
        expect(p[3].y).toBeCloseTo(20, 5);
    });

    test("a collinear constraint puts a second segment onto the first's line", () => {
        const doc = new TestDocument() as any;
        // Segment 0→1 on the x-axis; segment 2→3 starts skew and is made collinear with it.
        const node = new SketchNode({
            document: doc,
            plane: Plane.XY,
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 12, y: 3 }, // 2
                { x: 20, y: -4 }, // 3
            ],
            constraints: [
                { type: "fixed", point: 0, x: 0, y: 0 },
                { type: "fixed", point: 1, x: 10, y: 0 },
                // Keep their x positions so only y is free to move onto the line.
                { type: "distanceX", a: 0, b: 2, dx: 12 },
                { type: "distanceX", a: 0, b: 3, dx: 20 },
                { type: "collinear", a: 0, b: 1, c: 2, d: 3 },
            ],
        });
        const solved = node.solvedPoints();
        // Both points 2 and 3 drop onto the x-axis (y ≈ 0).
        expect(solved[2].y).toBeCloseTo(0, 5);
        expect(solved[3].y).toBeCloseTo(0, 5);
    });

    test("a midpoint constraint pins a point to the centre of a segment", () => {
        const doc = new TestDocument() as any;
        // Segment 0→1 from (0,0) to (10,4); point 2 starts off and is pinned to its midpoint (5,2).
        const node = new SketchNode({
            document: doc,
            plane: Plane.XY,
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 4 },
                { x: 9, y: -3 },
            ],
            constraints: [
                { type: "fixed", point: 0, x: 0, y: 0 },
                { type: "fixed", point: 1, x: 10, y: 4 },
                { type: "midpoint", point: 2, a: 0, b: 1 },
            ],
        });
        const solved = node.solvedPoints();
        expect(solved[2].x).toBeCloseTo(5, 5);
        expect(solved[2].y).toBeCloseTo(2, 5);
    });

    test("a symmetric constraint mirrors two points about an axis segment", () => {
        const doc = new TestDocument() as any;
        // Axis 0→1 along the Y axis (the line x=0). Points 2 and 3 should become mirror images
        // across it: equal |x|, equal y.
        const node = new SketchNode({
            document: doc,
            plane: Plane.XY,
            points: [
                { x: 0, y: 0 }, // 0 (axis start)
                { x: 0, y: 10 }, // 1 (axis end)
                { x: 3, y: 5 }, // 2
                { x: -7, y: 2 }, // 3 (skew; should mirror to x=-3, y=5)
            ],
            constraints: [
                { type: "fixed", point: 0, x: 0, y: 0 },
                { type: "fixed", point: 1, x: 0, y: 10 },
                { type: "fixed", point: 2, x: 3, y: 5 },
                { type: "symmetric", p: 2, q: 3, a: 0, b: 1 },
            ],
        });
        const solved = node.solvedPoints();
        // Point 3 mirrors point 2 across x=0: x = -3, y = 5.
        expect(solved[3].x).toBeCloseTo(-3, 5);
        expect(solved[3].y).toBeCloseTo(5, 5);
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
