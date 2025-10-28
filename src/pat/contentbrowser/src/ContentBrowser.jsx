import React, {
    Fragment,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ConfigContext,
    CurrentPathContext,
    SelectedItemsContext,
    SelectedUidsContext,
    PreviewUidsContext,
    ShowBrowserContext,
} from "./contexts";
import useContentStore from "./useContentStore";
import Favorites from "./Favorites";
import RecentlyUsed from "./RecentlyUsed";
import Icon from "./Icon";
import {
    debounce,
    formatDate,
    getItemsFromUids,
    isFolderish,
    itemIdentifier,
    updateRecentlyUsed,
    request,
} from "./utils";

function LoadMoreSentinel({ level, onVisible }) {
    const ref = useRef(null);

    useEffect(() => {
        if (!ref.current) {
            return undefined;
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    onVisible();
                }
            });
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [onVisible]);

    return <div className="loadmore" ref={ref}><div className="spinner" /></div>;
}

function UploadPanel({ config, currentPath, onAddItems, onClose }) {
    const inputRef = useRef(null);

    const handleChange = async (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) {
            return;
        }
        if (typeof config.onUpload === "function") {
            try {
                const uploadedItems = await config.onUpload(files, {
                    currentPath,
                    config,
                });
                if (uploadedItems?.length) {
                    onAddItems(uploadedItems);
                }
            } catch (err) {
                console.error("pat-contentbrowser: upload error", err);
            }
        }
        if (inputRef.current) {
            inputRef.current.value = "";
        }
        onClose();
    };

    return (
        <div className="upload-wrapper">
            <p>Select files to upload to <strong>{currentPath}</strong>.</p>
            <input
                ref={inputRef}
                type="file"
                multiple={config.maximumSelectionSize !== 1}
                accept={config.uploadAcceptedMimetypes || "*/*"}
                onChange={handleChange}
            />
            {!config.onUpload && (
                <p className="muted">
                    Provide an <code>onUpload</code> callback in the configuration to handle uploads.
                </p>
            )}
            <button type="button" className="cb-button" onClick={onClose}>
                Close
            </button>
        </div>
    );
}

export default function ContentBrowser() {
    const [config, setConfig] = useContext(ConfigContext);
    const [currentPath, setCurrentPath] = useContext(CurrentPathContext);
    const [selectedItems, setSelectedItems] = useContext(SelectedItemsContext);
    const [selectedUids, setSelectedUids] = useContext(SelectedUidsContext);
    const [previewUids, setPreviewUids] = useContext(PreviewUidsContext);
    const [showBrowser, setShowBrowser] = useContext(ShowBrowserContext);

    const store = useContentStore(config);
    const columnsRef = useRef(null);
    const [previewItem, setPreviewItem] = useState(null);
    const [searchValue, setSearchValue] = useState("");
    const [gridView, setGridView] = useState((config.layout || "list") === "grid");
    const [showUpload, setShowUpload] = useState(false);
    const defaultModeRef = useRef(config.mode || "browse");
    const lastFocusedUidRef = useRef(null);

    const closeBrowser = useCallback(() => {
        setShowUpload(false);
        setPreviewItem(null);
        setPreviewUids([]);
        setSearchValue("");
        setConfig((prev) => ({ ...prev, mode: defaultModeRef.current }));
        setShowBrowser(false);
    }, [setShowBrowser, setPreviewUids, setConfig]);

    useEffect(() => {
        if (!showBrowser) {
            return;
        }
        store.get({ path: currentPath });
    }, [showBrowser, currentPath, store]);

    useEffect(() => {
        if (!columnsRef.current) {
            return;
        }
        columnsRef.current.scrollTo({ left: columnsRef.current.scrollWidth, behavior: "smooth" });
    }, [store.levels]);

    const isSelectable = useCallback(
        (item) => {
            if (!item) return false;
            if (selectedUids.includes(item.UID)) return false;
            if (!config.selectableTypes?.length) return true;
            return config.selectableTypes.includes(item.portal_type);
        },
        [config.selectableTypes, selectedUids],
    );

    const isBrowseable = useCallback(
        (item) => {
            if (!item) return false;
            if (!isFolderish(item)) return false;
            if (!config.browseableTypes?.length) return true;
            return config.browseableTypes.includes(item.portal_type);
        },
        [config.browseableTypes],
    );

    const updatePreview = useCallback(
        ({ item, uuid, action }) => {
            if (action === "clear") {
                setPreviewItem(null);
                setPreviewUids([]);
                return;
            }
            if (item && action === "show") {
                setPreviewItem(item);
                setPreviewUids([item.UID]);
                lastFocusedUidRef.current = item.UID;
                return;
            }
            if (!uuid) {
                return;
            }
            setPreviewUids((prev) => {
                if (action === "add") {
                    if (config.maximumSelectionSize > 0 && prev.length >= config.maximumSelectionSize) {
                        return prev;
                    }
                    if (prev.includes(uuid)) {
                        return prev;
                    }
                    return [...prev, uuid];
                }
                if (action === "remove") {
                    const next = prev.filter((it) => it !== uuid);
                    if (next.length === 1 && previewItem && next[0] === previewItem.UID) {
                        return next;
                    }
                    return next;
                }
                return prev;
            });
        },
        [config.maximumSelectionSize, previewItem],
    );

    const showPreview = useCallback(
        (item) => {
            if (config.mode === "browse") {
                setPreviewUids([item.UID]);
                if (isBrowseable(item)) {
                    setCurrentPath(item.path);
                } else {
                    const parts = item.path.split("/");
                    const folderPath = parts.slice(0, parts.length - 1).join("/") || "/";
                    setCurrentPath(folderPath);
                    setPreviewItem(item);
                }
            } else {
                updatePreview({ item, action: "show" });
            }
        },
        [config.mode, isBrowseable, setCurrentPath, updatePreview],
    );

    const changePath = useCallback(
        (item) => {
            setShowUpload(false);
            updatePreview({ action: "clear" });
            if (item === "/" || item === config.rootPath) {
                setCurrentPath(config.rootPath || "/");
                return;
            }
            if (typeof item === "string") {
                setCurrentPath(item);
                return;
            }
            showPreview(item);
        },
        [config.rootPath, setCurrentPath, showPreview, updatePreview],
    );

    const handleItemClick = useCallback(
        (item, event) => {
            event.preventDefault();
            if (!showBrowser) {
                return;
            }
            const levelNode = event.currentTarget.closest(".levelItems");
            const siblings = Array.from(levelNode.querySelectorAll(".content-item"));
            if (config.maximumSelectionSize !== 1 && (event.metaKey || event.ctrlKey)) {
                updatePreview({ uuid: item.UID, action: previewUids.includes(item.UID) ? "remove" : "add" });
            } else if (config.maximumSelectionSize !== 1 && event.shiftKey && previewUids.length) {
                const activeUid = lastFocusedUidRef.current || previewUids[0];
                const startIndex = siblings.findIndex((node) => node.dataset.uuid === activeUid);
                const endIndex = siblings.findIndex((node) => node.dataset.uuid === item.UID);
                if (startIndex !== -1 && endIndex !== -1) {
                    const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
                    const range = siblings.slice(from, to + 1).map((node) => node.dataset.uuid);
                    setPreviewUids(range);
                }
            } else {
                changePath(item);
            }
            lastFocusedUidRef.current = item.UID;
        },
        [changePath, config.maximumSelectionSize, previewUids, setPreviewUids, showBrowser, updatePreview],
    );

    const addItem = useCallback(
        (item) => {
            if (!item) return;
            if (config.maximumSelectionSize === 1) {
                setSelectedItems([item]);
                setSelectedUids([item.UID]);
            } else {
                setSelectedItems((items) => {
                    if (items.find((it) => it.UID === item.UID)) {
                        return items;
                    }
                    const next = [...items, item];
                    setSelectedUids(next.map((it) => it.UID));
                    return next;
                });
            }
            updateRecentlyUsed(item, config);
            closeBrowser();
        },
        [closeBrowser, config, setSelectedItems, setSelectedUids],
    );

    const addSelectedItems = useCallback(async () => {
        const items = await getItemsFromUids(previewUids, config);
        setSelectedItems((prev) => {
            const existing = new Set(prev.map((item) => item.UID));
            const merged = [...prev];
            items.forEach((item) => {
                if (!existing.has(item.UID)) {
                    merged.push(item);
                }
            });
            setSelectedUids(merged.map((item) => item.UID));
            return merged;
        });
        if (items.length) {
            updateRecentlyUsed(items[items.length - 1], config);
        }
        closeBrowser();
    }, [closeBrowser, config, previewUids, setSelectedItems, setSelectedUids]);

    const handleRecentlyUsed = useCallback(
        (item) => {
            addItem(item);
        },
        [addItem],
    );

    const handleFavorite = useCallback(
        async (favorite) => {
            try {
                const response = await request({
                    vocabularyUrl: config.vocabularyUrl,
                    attributes: config.attributes,
                    levelInfoPath: favorite.path,
                });
                const item = response?.results?.[0] || { ...favorite };
                if (!item.path) {
                    item.path = favorite.path || config.rootPath;
                }
                changePath(item);
            } catch (err) {
                console.error("pat-contentbrowser: favorite not found", err);
            }
        },
        [changePath, config],
    );

    const debouncedSearch = useMemo(
        () =>
            debounce(async (value) => {
                if (defaultModeRef.current === "browse") {
                    setConfig((prev) => ({ ...prev, mode: value ? "search" : "browse" }));
                }
                await store.get({ path: currentPath, searchTerm: value, mode: value ? "search" : defaultModeRef.current });
                if (!value) {
                    setPreviewItem(null);
                    setPreviewUids([]);
                }
            }, 250),
        [currentPath, setConfig, store, setPreviewUids],
    );

    const filterLevel = useMemo(
        () =>
            debounce((value) => {
                if (value === "") {
                    setPreviewUids([]);
                }
                store.get({ path: currentPath, searchTerm: value, updateCache: true });
            }, 250),
        [currentPath, store, setPreviewUids],
    );

    useEffect(() => {
        function handleKey(event) {
            if (event.key === "Escape" && showBrowser) {
                closeBrowser();
            }
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [closeBrowser, showBrowser]);

    if (!showBrowser) {
        return null;
    }

    return (
        <div className="content-browser-position-wrapper" onClick={closeBrowser}>
            <nav className="content-browser" onClick={(event) => event.stopPropagation()}>
                <div className="toolBar">
                    <div className="input-group">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search"
                            value={searchValue}
                            onChange={(event) => {
                                const value = event.target.value;
                                setSearchValue(value);
                                debouncedSearch(value);
                            }}
                        />
                        {searchValue && (
                            <button
                                type="button"
                                className="cb-button"
                                onClick={() => {
                                    setSearchValue("");
                                    debouncedSearch("");
                                }}
                            >
                                <Icon name="x" />
                            </button>
                        )}
                    </div>
                    <RecentlyUsed config={config} onSelect={handleRecentlyUsed} />
                    <Favorites favorites={config.favorites} onSelect={handleFavorite} />
                    {config.uploadEnabled && config.mode === "browse" && (
                        <button
                            type="button"
                            className="cb-button"
                            onClick={() => {
                                setShowUpload(true);
                                setPreviewItem(null);
                                setPreviewUids([]);
                            }}
                        >
                            <Icon name="upload" /> Upload
                        </button>
                    )}
                    <button type="button" className="cb-button" onClick={closeBrowser}>
                        <Icon name="x-circle" />
                    </button>
                </div>
                <div className="levelColumns" ref={columnsRef}>
                    {store.isLoading && !store.levels.length ? (
                        <p className="muted">Loading…</p>
                    ) : (
                        <Fragment>
                            {store.levels.map((level, index) => (
                                <div
                                    key={level.path || index}
                                    className={`levelColumn ${index === store.levels.length - 1 ? "active" : ""}`}
                                >
                                    <div className="levelToolbar">
                                        {index === 0 && config.mode === "browse" && (
                                            <button
                                                type="button"
                                                className="cb-button-link"
                                                onClick={() => changePath(config.rootPath || "/")}
                                            >
                                                <Icon name="house" />
                                            </button>
                                        )}
                                        {index === store.levels.length - 1 && (
                                            <div className="levelActions">
                                                {level.selectable && !previewItem && isSelectable(level) && (
                                                    <button
                                                        type="button"
                                                        className="cb-button"
                                                        onClick={() => addItem(level)}
                                                    >
                                                        <Icon name="plus" />
                                                        <span className="ellipsis">{level.Title || itemIdentifier(level)}</span>
                                                    </button>
                                                )}
                                                {config.mode !== "search" && (
                                                    <input
                                                        type="text"
                                                        className="filter-input"
                                                        defaultValue={level.searchTerm || ""}
                                                        placeholder="Filter level"
                                                        onChange={(event) => filterLevel(event.target.value)}
                                                    />
                                                )}
                                                <button
                                                    type="button"
                                                    className="cb-button"
                                                    onClick={() => setGridView((prev) => !prev)}
                                                >
                                                    <Icon name={gridView ? "list" : "grid"} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="levelItems">
                                        {(level.results || []).map((item, position) => {
                                            const inPath = item.path && currentPath.startsWith(item.path);
                                            const selected = previewUids.includes(item.UID);
                                            return (
                                                <div
                                                    key={item.UID}
                                                    className={`content-item ${position % 2 ? "even" : "odd"} ${
                                                        inPath ? "inPath" : ""
                                                    } ${selected ? "selectedItem" : ""}`}
                                                    data-uuid={item.UID}
                                                    role="button"
                                                    tabIndex={position}
                                                    onClick={(event) => handleItemClick(item, event)}
                                                >
                                                    <div className={gridView ? "grid-preview" : "item-title"}>
                                                        {gridView && item.getIcon ? (
                                                            <img
                                                                src={`${item.getURL}/@@images/image/thumb`}
                                                                alt={item.Title || itemIdentifier(item)}
                                                            />
                                                        ) : (
                                                            <Icon
                                                                name={`contenttype/${item.portal_type}`}
                                                                portalType={item.portal_type}
                                                            />
                                                        )}
                                                        <span className={!item.Title ? "id-only" : ""}>
                                                            {item.Title || itemIdentifier(item)}
                                                        </span>
                                                        {config.mode === "search" && (
                                                            <span className="item-path">{item.path}</span>
                                                        )}
                                                    </div>
                                                    {isBrowseable(item) && config.mode === "browse" && (
                                                        <div className="browseSub">
                                                            <Icon name="arrow-right-circle" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {level.load_more && (
                                            <LoadMoreSentinel
                                                level={level}
                                                onVisible={() =>
                                                    store.get({
                                                        loadMorePath: level.path,
                                                        page: (level.page || 1) + 1,
                                                        searchTerm: level.searchTerm,
                                                    })
                                                }
                                            />
                                        )}
                                        {level.total === 0 && <p className="muted">No results.</p>}
                                    </div>
                                </div>
                            ))}
                            {previewUids.length === 1 && previewItem && (
                                <div className="preview">
                                    <div className="levelToolbar">
                                        {isSelectable(previewItem) && (
                                            <button type="button" className="cb-button" onClick={() => addItem(previewItem)}>
                                                <Icon name="plus" />
                                                <span className="ellipsis">{previewItem.Title}</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="info">
                                        {previewItem.getIcon ? (
                                            <img
                                                src={`${previewItem.getURL}/@@images/image/preview`}
                                                alt={previewItem.Title}
                                            />
                                        ) : (
                                            <Icon portalType={previewItem.portal_type} className="preview-icon" />
                                        )}
                                        <dl>
                                            <dt>Id</dt>
                                            <dd>{itemIdentifier(previewItem)}</dd>
                                            <dt>Title</dt>
                                            <dd>{previewItem.Title}</dd>
                                            {previewItem.Description && (
                                                <>
                                                    <dt>Description</dt>
                                                    <dd title={previewItem.Description}>{previewItem.Description}</dd>
                                                </>
                                            )}
                                            {previewItem.created && (
                                                <>
                                                    <dt>Created</dt>
                                                    <dd>{formatDate(previewItem.created)}</dd>
                                                </>
                                            )}
                                            {previewItem.modified && (
                                                <>
                                                    <dt>Modified</dt>
                                                    <dd>{formatDate(previewItem.modified)}</dd>
                                                </>
                                            )}
                                            {previewItem.review_state && (
                                                <>
                                                    <dt>Review state</dt>
                                                    <dd>{previewItem.review_state}</dd>
                                                </>
                                            )}
                                        </dl>
                                    </div>
                                </div>
                            )}
                            {previewUids.length > 1 && (
                                <div className="preview">
                                    <div className="levelToolbar">
                                        <button type="button" className="cb-button" onClick={addSelectedItems}>
                                            <Icon name="plus" />
                                            <span className="ellipsis">Add selected items</span>
                                        </button>
                                    </div>
                                    <div className="info">
                                        <Icon name="files" />
                                        <span>{previewUids.length} items selected</span>
                                    </div>
                                </div>
                            )}
                            {showUpload && (
                                <UploadPanel
                                    config={config}
                                    currentPath={currentPath}
                                    onAddItems={(items) => {
                                        items.forEach((item) => updateRecentlyUsed(item, config));
                                        setPreviewUids(items.map((item) => item.UID));
                                        if (config.uploadAddImmediately) {
                                            setSelectedItems((prev) => {
                                                const map = new Map(prev.map((item) => [item.UID, item]));
                                                items.forEach((item) => map.set(item.UID, item));
                                                const next = Array.from(map.values());
                                                setSelectedUids(next.map((item) => item.UID));
                                                return next;
                                            });
                                            closeBrowser();
                                        }
                                    }}
                                    onClose={() => setShowUpload(false)}
                                />
                            )}
                        </Fragment>
                    )}
                </div>
            </nav>
        </div>
    );
}
