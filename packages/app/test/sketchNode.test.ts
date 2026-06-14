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
});
