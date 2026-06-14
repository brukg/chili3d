// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, LinkNode } from "../src";
import { TestDocument } from "./testDocument";

describe("LinkNode", () => {
    const doc: IDocument = new TestDocument() as any;

    test("is a named container with a default mass of 1", () => {
        const link = new LinkNode({ document: doc, name: "base_link" });
        expect(link.name).toBe("base_link");
        expect(link.mass).toBe(1);
        link.mass = 2.5;
        expect(link.mass).toBe(2.5);
    });
});
