// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { longestChain, type ReachNode } from "../src/robot/reach";

describe("kinematic reach", () => {
    test("a single node's reach is its own length", () => {
        expect(longestChain({ length: 5, children: [] })).toBe(5);
    });

    test("a straight chain sums the link lengths", () => {
        const chain: ReachNode = {
            length: 0, // base
            children: [{ length: 100, children: [{ length: 80, children: [{ length: 30, children: [] }] }] }],
        };
        expect(longestChain(chain)).toBe(210);
    });

    test("a branching tree takes the longest path, not the sum of all", () => {
        const tree: ReachNode = {
            length: 0,
            children: [
                { length: 100, children: [{ length: 50, children: [] }] }, // 150
                { length: 100, children: [{ length: 200, children: [] }] }, // 300 ← longest
            ],
        };
        expect(longestChain(tree)).toBe(300);
    });

    test("a terminal tip extent contributes to the reach", () => {
        // a joint with both a child joint and a tip leaf takes whichever reaches farther
        const tree: ReachNode = {
            length: 0,
            children: [
                {
                    length: 100,
                    children: [
                        { length: 40, children: [] }, // child joint chain → 40
                        { length: 70, children: [] }, // tip extent → 70 ← longer
                    ],
                },
            ],
        };
        expect(longestChain(tree)).toBe(170);
    });
});
