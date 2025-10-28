import React, { useEffect, useMemo, useState } from "react";
import ContentBrowser from "./ContentBrowser.jsx";
import SelectedItems from "./SelectedItems.jsx";
import {
    ConfigContext,
    CurrentPathContext,
    PathCacheContext,
    PreviewUidsContext,
    SelectedItemsContext,
    SelectedUidsContext,
    ShowContentBrowserContext,
} from "./context";

function deriveInitialPath({ basePath = "", rootPath = "", vocabularyUrl = "" }) {
    let current = "";
    if (basePath || rootPath) {
        current = basePath.indexOf(rootPath) !== 0 ? rootPath : basePath;
        if (
            rootPath &&
            current !== rootPath &&
            current.indexOf(rootPath) === 0
        ) {
            current = current.replace(rootPath, "") || "/";
        }
    } else if (vocabularyUrl) {
        try {
            const vocabPath = new URL(vocabularyUrl, window.location.origin)
                .pathname.split("/");
            const derived =
                vocabPath.slice(0, vocabPath.length - 1).join("/") || "/";
            current = derived;
        } catch (e) {
            current = "/";
        }
    }
    return current || "/";
}

function buildConfig(props, overrides = {}) {
    return {
        mode: props.mode || "browse",
        layout: props.layout || "list",
        attributes: props.attributes || [],
        contextPath: props.contextPath,
        vocabularyUrl: props.vocabularyUrl,
        width: props.width,
        maxDepth: props.maxDepth,
        rootPath: props.rootPath || "",
        rootUrl: props.rootUrl || "",
        basePath: props.basePath || "",
        selectableTypes: props.selectableTypes || [],
        browseableTypes: props.browseableTypes || [],
        searchIndex: props.searchIndex || "SearchableText",
        maximumSelectionSize:
            typeof props.maximumSelectionSize === "number"
                ? props.maximumSelectionSize
                : -1,
        separator: props.separator || ",",
        selection: props.selection || [],
        query: props.query || {},
        fieldId: props.fieldId,
        uploadEnabled: props.upload,
        uploadAddImmediately:
            props.uploadAddImmediately !== undefined
                ? props.uploadAddImmediately
                : true,
        uploadAcceptedMimetypes: props.uploadAcceptedMimetypes,
        favorites: props.favorites,
        recentlyUsed: props.recentlyUsed,
        recentlyUsedKey: props.recentlyUsedKey,
        recentlyUsedMaxItems: props.recentlyUsedMaxItems,
        pageSize: props.bSize || 20,
        sortOn: props.sortOn || "sortable_title",
        sortOrder: props.sortOrder || "ascending",
        componentRegistryKeys: props.componentRegistryKeys || {},
        ...overrides,
    };
}

export default function App(props) {
    const [config, setConfig] = useState(() => buildConfig(props));
    const [currentPath, setCurrentPath] = useState(() =>
        deriveInitialPath({
            basePath: props.basePath,
            rootPath: props.rootPath,
            vocabularyUrl: props.vocabularyUrl,
        }),
    );
    const [pathCache, setPathCache] = useState({});
    const [selectedItems, setSelectedItems] = useState([]);
    const [selectedUids, setSelectedUids] = useState([]);
    const [previewUids, setPreviewUids] = useState([]);
    const [showContentBrowser, setShowContentBrowser] = useState(false);

    useEffect(() => {
        if (!currentPath) {
            setCurrentPath(
                deriveInitialPath({
                    basePath: config.basePath,
                    rootPath: config.rootPath,
                    vocabularyUrl: config.vocabularyUrl,
                }),
            );
        }
    }, [config, currentPath]);

    const configValue = useMemo(
        () => ({ config, setConfig }),
        [config],
    );

    const currentPathValue = useMemo(
        () => ({ currentPath, setCurrentPath }),
        [currentPath],
    );

    const pathCacheValue = useMemo(
        () => ({ pathCache, setPathCache }),
        [pathCache],
    );

    const selectedItemsValue = useMemo(
        () => ({ selectedItems, setSelectedItems }),
        [selectedItems],
    );

    const selectedUidsValue = useMemo(
        () => ({ selectedUids, setSelectedUids }),
        [selectedUids],
    );

    const previewUidsValue = useMemo(
        () => ({ previewUids, setPreviewUids }),
        [previewUids],
    );

    const showContentBrowserValue = useMemo(
        () => ({ showContentBrowser, setShowContentBrowser }),
        [showContentBrowser],
    );

    return (
        <ConfigContext.Provider value={configValue}>
            <CurrentPathContext.Provider value={currentPathValue}>
                <PathCacheContext.Provider value={pathCacheValue}>
                    <SelectedItemsContext.Provider value={selectedItemsValue}>
                        <SelectedUidsContext.Provider value={selectedUidsValue}>
                            <PreviewUidsContext.Provider value={previewUidsValue}>
                                <ShowContentBrowserContext.Provider
                                    value={showContentBrowserValue}
                                >
                                    <ContentBrowser />
                                    <SelectedItems />
                                </ShowContentBrowserContext.Provider>
                            </PreviewUidsContext.Provider>
                        </SelectedUidsContext.Provider>
                    </SelectedItemsContext.Provider>
                </PathCacheContext.Provider>
            </CurrentPathContext.Provider>
        </ConfigContext.Provider>
    );
}
