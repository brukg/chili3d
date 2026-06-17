// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { parseModelXml } from "../src/threemf/threeMfImporter";

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
});
