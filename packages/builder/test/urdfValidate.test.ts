// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { JointNode, LinkNode } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { TestDocument } from "../../core/test/testDocument";
import { validateRobotTree } from "../src/urdf/urdfValidate";

describe("validateRobotTree", () => {
    const doc = new TestDocument() as any;
    const link = (name: string) => new LinkNode({ document: doc, name });
    const joint = (name: string) => new JointNode({ document: doc, name, jointType: "revolute" });

    test("a well-formed tree has no issues", () => {
        const base = link("base");
        const j = joint("j1");
        j.add(link("arm"));
        base.add(j);
        expect(validateRobotTree(base)).toEqual([]);
    });

    test("flags a joint with no child link", () => {
        const base = link("base");
        base.add(joint("j1")); // no child link
        const issues = validateRobotTree(base);
        expect(issues.some((i) => i.includes("no child link"))).toBe(true);
    });

    test("flags duplicate link names", () => {
        const base = link("base");
        const j = joint("j1");
        j.add(link("base")); // duplicate name
        base.add(j);
        expect(validateRobotTree(base).some((i) => i.includes("Duplicate link"))).toBe(true);
    });

    test("flags a dangling mimic reference", () => {
        const base = link("base");
        const j = joint("j1");
        j.add(link("arm"));
        base.add(j);
        j.mimicJoint = "does-not-exist";
        expect(validateRobotTree(base).some((i) => i.includes("mimics a joint"))).toBe(true);
    });

    test("accepts a valid mimic between two joints", () => {
        const base = link("base");
        const j1 = joint("j1");
        const arm = link("arm");
        j1.add(arm);
        base.add(j1);
        const j2 = joint("j2");
        j2.add(link("hand"));
        arm.add(j2);
        j2.mimicJoint = j1.id; // valid reference
        expect(validateRobotTree(base)).toEqual([]);
    });
});
