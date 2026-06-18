// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { bomToCsv, buildBomRows } from "../src/commands/application/exportBom";

describe("BOM export", () => {
    test("buildBomRows tallies quantities and numbers rows alphabetically", () => {
        const rows = buildBomRows(["Box", "Sphere", "Box", "Box", "Cylinder"]);
        expect(rows).toEqual([
            { item: 1, name: "Box", quantity: 3 },
            { item: 2, name: "Cylinder", quantity: 1 },
            { item: 3, name: "Sphere", quantity: 1 },
        ]);
    });

    test("an empty model yields no rows", () => {
        expect(buildBomRows([])).toEqual([]);
    });

    test("bomToCsv emits a header and one line per row", () => {
        const csv = bomToCsv([
            { item: 1, name: "Box", quantity: 3 },
            { item: 2, name: "Sphere", quantity: 1 },
        ]);
        expect(csv).toBe("Item,Name,Quantity\n1,Box,3\n2,Sphere,1\n");
    });

    test("bomToCsv quotes names containing commas or quotes", () => {
        const csv = bomToCsv(buildBomRows(["Bracket, left", 'Pin "A"']));
        expect(csv).toContain('"Bracket, left"');
        expect(csv).toContain('"Pin ""A"""');
    });
});
