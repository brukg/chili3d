// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { parseItemTransform, parseModelXml } from "../src/threemf/threeMfImporter";

const MODEL = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="2" y="0" z="0"/>
          <vertex x="2" y="3" z="0"/>
          <vertex x="0" y="3" z="0"/>
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2"/>
          <triangle v3="3" v1="0" v2="2"/>
        </triangles>
      </mesh>
    </object>
  </resources>
</model>`;

describe("3MF importer", () => {
    test("parses the model XML into 4 vertices and 2 triangles", () => {
        const { position, index } = parseModelXml(MODEL);
        expect(position.length).toBe(4 * 3);
        expect(index.length).toBe(2 * 3);
        // Third vertex is (2,3,0); attributes are read by name so out-of-order v3/v1/v2 still works.
        expect([position[6], position[7], position[8]]).toEqual([2, 3, 0]);
        expect(Array.from(index.slice(3, 6))).toEqual([0, 2, 3]);
    });

    test("bakes a build-item translate transform into the vertices", () => {
        // Identity rotation, translation (10, 5, 2).
        const xml = MODEL.replace(
            "</resources>",
            '</resources><build><item objectid="1" transform="1 0 0 0 1 0 0 0 1 10 5 2"/></build>',
        );
        const { position } = parseModelXml(xml);
        // Vertex 2 was (2,3,0) → (12,8,2).
        expect([position[6], position[7], position[8]]).toEqual([12, 8, 2]);
        // Vertex 0 was the origin → the pure translation.
        expect([position[0], position[1], position[2]]).toEqual([10, 5, 2]);
    });

    test("applies the linear part: a 90° rotation about Z maps (2,0,0) → (0,2,0)", () => {
        // Row-vector affine: x' = x·m00 + y·m10 + …; a +90° z-rotation has m00=0,m01=1,m10=-1,m11=0.
        const xml = MODEL.replace(
            "</resources>",
            '</resources><build><item objectid="1" transform="0 1 0 -1 0 0 0 0 1 0 0 0"/></build>',
        );
        const { position } = parseModelXml(xml);
        // Vertex 1 was (2,0,0) → (0,2,0).
        expect(position[3]).toBeCloseTo(0, 6);
        expect(position[4]).toBeCloseTo(2, 6);
        expect(position[5]).toBeCloseTo(0, 6);
    });

    test("parseItemTransform returns undefined when there is no build transform", () => {
        expect(parseItemTransform(MODEL)).toBeUndefined();
    });
});
