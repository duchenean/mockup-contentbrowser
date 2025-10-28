import React from "react";
import { createRoot } from "react-dom/client";
import App from "./src/App.jsx";

export function renderContentBrowser(element, props = {}) {
    if (!element) {
        throw new Error("renderContentBrowser requires a target element");
    }
    const root = createRoot(element);
    root.render(<App {...props} />);
    return root;
}

export default App;
