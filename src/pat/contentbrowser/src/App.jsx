import React, { useEffect, useRef, useState } from "react";
import ContentBrowser from "./ContentBrowser";
import SelectedItems from "./SelectedItems";
import {
    ConfigContext,
    CurrentPathContext,
    PreviewUidsContext,
    SelectedItemsContext,
    SelectedUidsContext,
    ShowBrowserContext,
} from "./contexts";
import { ensureArray, getItemsFromUids, normalizePath } from "./utils";
import "./styles.css";

const DEFAULT_ATTRIBUTES = [
    "UID",
    "Title",
    "Description",
    "portal_type",
    "path",
    "getURL",
    "getIcon",
    "is_folderish",
    "review_state",
    "created",
    "modified",
];

function deriveConfig(props) {
    const initialRoot = props.rootPath || "/";
    const config = {
        mode: props.mode || "browse",
        layout: props.layout || "list",
        attributes: props.attributes || DEFAULT_ATTRIBUTES,
        contextPath: props.contextPath || "",
        vocabularyUrl: props.vocabularyUrl || "",
        width: props.width,
        maxDepth: props.maxDepth,
        rootPath: props.rootPath || "/",
        rootUrl: props.rootUrl || "",
        basePath: props.basePath || props.rootPath || "/",
        selectableTypes: props.selectableTypes || [],
        browseableTypes: props.browseableTypes || [],
        searchIndex: props.searchIndex || "SearchableText",
        maximumSelectionSize:
            typeof props.maximumSelectionSize === "number" ? props.maximumSelectionSize : -1,
        separator: props.separator || ",",
        selection: ensureArray(props.selection),
        query: props.query || {},
        fieldId: props.fieldId,
        uploadEnabled: !!props.upload,
        uploadAddImmediately:
            typeof props.uploadAddImmediately === "boolean" ? props.uploadAddImmediately : true,
        uploadAcceptedMimetypes: props.uploadAcceptedMimetypes,
        favorites: props.favorites || [],
        recentlyUsed: !!props.recentlyUsed,
        recentlyUsedKey: props.recentlyUsedKey,
        recentlyUsedMaxItems: props.recentlyUsedMaxItems || 20,
        pageSize: props.bSize || 20,
        sortOn: props.sortOn || "sortable_title",
        sortOrder: props.sortOrder || "ascending",
        componentRegistryKeys: props.componentRegistryKeys || {},
        onUpload: props.onUpload,
    };

    if (!props.rootPath && props.vocabularyUrl) {
        try {
            const url = new URL(props.vocabularyUrl, "http://localhost");
            const parts = url.pathname.split("/");
            const path = parts.slice(0, parts.length - 1).join("/") || "/";
            config.rootPath = path;
            config.basePath = props.basePath || path;
        } catch (err) {
            config.rootPath = initialRoot;
        }
    }

    return config;
}

function determineInitialPath(config) {
    const basePath = normalizePath(config.basePath || config.rootPath || "/");
    const rootPath = normalizePath(config.rootPath || "/");
    if (basePath.startsWith(rootPath)) {
        return basePath || rootPath;
    }
    return rootPath;
}

export default function App(props) {
    const initialConfigRef = useRef(deriveConfig(props));
    const [config, setConfig] = useState(initialConfigRef.current);
    const [currentPath, setCurrentPath] = useState(() => determineInitialPath(initialConfigRef.current));
    const [selectedItems, setSelectedItems] = useState([]);
    const [selectedUids, setSelectedUids] = useState([]);
    const [previewUids, setPreviewUids] = useState([]);
    const [showBrowser, setShowBrowser] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function loadInitialSelection() {
            if (!config.selection || !config.selection.length) {
                setSelectedItems([]);
                setSelectedUids([]);
                return;
            }
            try {
                const items = await getItemsFromUids(config.selection, config);
                if (!cancelled) {
                    setSelectedItems(items);
                    setSelectedUids(items.map((item) => item.UID));
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("pat-contentbrowser: unable to load initial selection", err);
                    setSelectedItems([]);
                    setSelectedUids([]);
                }
            }
        }
        loadInitialSelection();
        return () => {
            cancelled = true;
        };
    }, [config.selection, config.vocabularyUrl, config.attributes]);

    useEffect(() => {
        if (typeof props.onSelectionChange === "function") {
            props.onSelectionChange(selectedItems);
        }
    }, [selectedItems, props.onSelectionChange]);

    return (
        <ConfigContext.Provider value={[config, setConfig]}>
            <CurrentPathContext.Provider value={[currentPath, setCurrentPath]}>
                <SelectedItemsContext.Provider value={[selectedItems, setSelectedItems]}>
                    <SelectedUidsContext.Provider value={[selectedUids, setSelectedUids]}>
                        <PreviewUidsContext.Provider value={[previewUids, setPreviewUids]}>
                            <ShowBrowserContext.Provider value={[showBrowser, setShowBrowser]}>
                                <div className="content-browser-app">
                                    <SelectedItems />
                                    <ContentBrowser />
                                </div>
                            </ShowBrowserContext.Provider>
                        </PreviewUidsContext.Provider>
                    </SelectedUidsContext.Provider>
                </SelectedItemsContext.Provider>
            </CurrentPathContext.Provider>
        </ConfigContext.Provider>
    );
}
