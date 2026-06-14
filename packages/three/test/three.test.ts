// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    GroupNode,
    type IVisualGeometry,
    Material,
    Matrix4,
    type ShapeNode,
    ShapeTypes,
    XY,
    XYZ,
} from "@chili3d/core";
import { TestDocument } from "./testDocument";
import { TestNode } from "./testEdge";
import { TestView } from "./testView";

(global as any).ResizeObserver = rs.fn().mockImplementation(() => ({
    observe: rs.fn(),
    unobserve: rs.fn(),
    disconnect: rs.fn(),
}));

describe("three test", () => {
    const doc = new TestDocument();
    doc.modelManager.materials.push(new Material({ document: doc, name: "test", color: 0x00ff00 }));
    const view = new TestView(doc, doc.visual.context);

    test("test view", () => {
        expect(view.screenToCameraRect(0, 0)).toEqual(new XY({ x: -1, y: 1 }));
        expect(view.screenToCameraRect(100, 100)).toEqual(new XY({ x: 1, y: -1 }));
        const world = view.screenToWorld(50, 50);
        expect(view.worldToScreen(world)).toEqual(new XY({ x: 50, y: 50 }));
    });

    test("test context", () => {
        const context = doc.visual.context;
        const model = new TestNode(doc, XYZ.zero, new XYZ({ x: 100, y: 0, z: 0 }));
        context.addNode([model]);
        expect(context.getVisual(model)).not.toBeNull();
        const mouse = view.worldToScreen(new XYZ({ x: 50, y: 0, z: 0 }));
        const shapes = view.detectShapes(ShapeTypes.shape, mouse.x, mouse.y);
        expect(shapes.length).toEqual(1);
        expect(shapes[0].shape.shapeType).toBe(ShapeTypes.edge);

        const shape = context.getVisual(model) as IVisualGeometry;
        expect(shapes.at(0)?.shape).toEqual((shape?.geometryNode as ShapeNode).shape.value);
        expect(context.getNode(shape)).toEqual(model);

        context.removeNode([model]);
        expect(view.detectShapes(ShapeTypes.shape, mouse.x, mouse.y).length).toEqual(0);
    });

    test("nests a child visual under its group even when built bottom-up (URDF import order)", () => {
        const context = doc.visual.context;
        const group = new GroupNode({ document: doc, name: "g" });
        const child = new TestNode(doc, XYZ.zero, new XYZ({ x: 50, y: 0, z: 0 }));

        // Bottom-up: the child's visual is created while the group still has no visual...
        context.addNode([child]);
        // ...then the group's visual is created. The child must be adopted under it, not stranded.
        group.add(child);
        context.addNode([group]);

        const childVisual = context.getVisual(child) as any;
        const groupVisual = context.getVisual(group) as any;
        expect(groupVisual).toBeTruthy();
        expect(childVisual.parent).toBe(groupVisual);

        // A transform on the group must now propagate to the child's world matrix.
        groupVisual.transform = Matrix4.fromTranslation(0, 0, 100);
        groupVisual.updateMatrixWorld(true);
        const t = childVisual.matrixWorld.elements;
        expect([t[12], t[13], t[14]]).toEqual([0, 0, 100]);

        context.removeNode([child]);
        context.removeNode([group]);
    });
});
