import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./contentbrowser";

describe("Content Browser (React)", () => {
    beforeEach(() => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                results: [
                    {
                        UID: "uid-1",
                        Title: "Document 1",
                        path: "/documents/doc-1",
                        portal_type: "Document",
                    },
                ],
                total: 1,
            }),
        });
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it.skip("renders initial selection", async () => {
        render(<App vocabularyUrl="/mock" selection={["uid-1"]} />);
        expect(await screen.findByText("Document 1")).toBeInTheDocument();
    });
});
