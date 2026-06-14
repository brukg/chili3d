// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDisposable, JointNode, PubSub } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { JointGizmoController } from "../src/jointGizmoController";
import type { ThreeView } from "../src/threeView";
import { TestDocument } from "./testDocument";

describe("JointGizmoController", () => {
    const doc = new TestDocument() as any;

    function setup() {
        const created: { disposed: boolean }[] = [];
        const stubView = {} as ThreeView;
        const factory = (): IDisposable => {
            const g = {
                disposed: false,
                dispose() {
                    this.disposed = true;
                },
            };
            created.push(g);
            return g;
        };
        const controller = new JointGizmoController(factory, () => stubView);
        return { controller, created };
    }

    test("creates a gizmo when exactly one JointNode is selected", () => {
        const { controller, created } = setup();
        const joint = new JointNode({ document: doc, name: "j" });
        PubSub.default.pub("selectionChanged", doc, [joint], []);
        expect(created.length).toBe(1);
        controller.dispose();
    });

    test("disposes the gizmo when selection becomes empty", () => {
        const { controller, created } = setup();
        const joint = new JointNode({ document: doc, name: "j" });
        PubSub.default.pub("selectionChanged", doc, [joint], []);
        PubSub.default.pub("selectionChanged", doc, [], []);
        expect(created[0].disposed).toBe(true);
        controller.dispose();
    });

    test("does not create a gizmo for a non-joint selection", () => {
        const { controller, created } = setup();
        const notAJoint = { id: "x" } as any;
        PubSub.default.pub("selectionChanged", doc, [notAJoint], []);
        expect(created.length).toBe(0);
        controller.dispose();
    });

    test("does not create a gizmo when multiple nodes are selected", () => {
        const { controller, created } = setup();
        const a = new JointNode({ document: doc, name: "a" });
        const b = new JointNode({ document: doc, name: "b" });
        PubSub.default.pub("selectionChanged", doc, [a, b], []);
        expect(created.length).toBe(0);
        controller.dispose();
    });

    test("dispose() unsubscribes so later selections create nothing", () => {
        const { controller, created } = setup();
        controller.dispose();
        const joint = new JointNode({ document: doc, name: "j" });
        PubSub.default.pub("selectionChanged", doc, [joint], []);
        expect(created.length).toBe(0);
    });
});
