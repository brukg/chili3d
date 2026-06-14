// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { ParameterStore } from "../src/parameter/parameterStore";
import { TestDocument } from "./testDocument";

describe("ParameterStore", () => {
    test("set/get/list/remove round-trip through document.userData", () => {
        const doc = new TestDocument() as any;
        const store = new ParameterStore(doc);
        store.set("width", "50");
        store.set("height", "width * 2");
        expect(store.get("width")?.expression).toBe("50");
        expect(store.list().length).toBe(2);
        expect((doc.userData.parameters as any[]).length).toBe(2); // persisted in userData
        store.remove("width");
        expect(store.get("width")).toBeUndefined();
    });

    test("resolve evaluates chained references in dependency order", () => {
        const doc = new TestDocument() as any;
        const store = new ParameterStore(doc);
        store.set("a", "2");
        store.set("b", "a * 3");
        store.set("c", "b + 1");
        const scope = store.resolve();
        expect(scope.isOk).toBe(true);
        expect(scope.value).toEqual({ a: 2, b: 6, c: 7 });
    });

    test("resolve errors on cycles and unknown references", () => {
        const doc = new TestDocument() as any;
        const store = new ParameterStore(doc);
        store.set("a", "b");
        store.set("b", "a");
        expect(store.resolve().isOk).toBe(false);

        const doc2 = new TestDocument() as any;
        const store2 = new ParameterStore(doc2);
        store2.set("x", "missing + 1");
        expect(store2.resolve().isOk).toBe(false);
    });

    test("rejects invalid parameter names", () => {
        const doc = new TestDocument() as any;
        const store = new ParameterStore(doc);
        expect(store.set("2bad", "1").isOk).toBe(false);
        expect(store.set("good_name", "1").isOk).toBe(true);
    });
});
