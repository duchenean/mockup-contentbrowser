import React from "react";
import { createRoot } from "react-dom/client";
import utils from "../../core/utils";
import plone_registry from "@plone/registry";
import App from "./src/App.jsx";
import SelectedItem from "./src/SelectedItem.jsx";

plone_registry.registerComponent({
    name: "pat-contentbrowser.SelectedItem",
    component: SelectedItem,
});

class ContentBrowser {
    constructor(el, options = {}) {
        this.el = el;
        this.options = options;
        this.root = null;
        this.init();
    }

    init() {
        this.el.style.display = "none";
        let nodeId = this.el.getAttribute("id");
        if (!nodeId) {
            nodeId = utils.generateId();
            this.el.setAttribute("id", nodeId);
        }

        const wrapper = document.createElement("div");
        wrapper.classList.add("content-browser-wrapper");
        this.el.parentNode.insertBefore(wrapper, this.el);

        this.root = createRoot(wrapper);
        this.root.render(<App fieldId={nodeId} {...this.options} />);
    }

    destroy() {
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
    }
}

export default ContentBrowser;
export { ContentBrowser };
