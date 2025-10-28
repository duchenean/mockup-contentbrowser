import ContentBrowser from "./contentbrowser";

describe("Content Browser", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("creates a content browser wrapper", () => {
        const field = document.createElement("input");
        field.type = "text";
        field.className = "pat-contentbrowser";
        document.body.appendChild(field);

        const browser = new ContentBrowser(field, {
            vocabularyUrl: "/contentbrowser-test.json",
        });

        expect(document.querySelectorAll(".content-browser-wrapper").length).toBe(1);

        browser.destroy();
    });
});
