import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import utils from "../../../core/utils";
import _t from "../../../core/i18n-wrapper";
import {
    useConfig,
    useCurrentPath,
    usePathCache,
    usePreviewUids,
    useSelectedItems,
    useSelectedUids,
    useShowContentBrowser,
} from "./context";
import useContentStore from "./useContentStore";
import {
    formatDate,
    get_items_from_uids,
    recentlyUsedItems,
    request,
    updateRecentlyUsed,
} from "./utils";
import Favorites from "./Favorites.jsx";
import RecentlyUsed from "./RecentlyUsed.jsx";
import Icon from "./Icon.jsx";

function useClickOutside(ref, handler) {
    useEffect(() => {
        function listener(event) {
            if (!ref.current || ref.current.contains(event.target)) {
                return;
            }
            handler(event);
        }
        document.addEventListener("mousedown", listener, true);
        return () => {
            document.removeEventListener("mousedown", listener, true);
        };
    }, [handler, ref]);
}

function ItemIcon({ item }) {
    const iconName = useMemo(() => {
        if (!item) return null;
        if (item.getIcon) {
            return null;
        }
        const type = (item.portal_type || "").toLowerCase().replace(/[\.\s]/g, "-");
        return `contenttype/${type}`;
    }, [item]);

    if (item?.getIcon) {
        return (
            <span
                className="plone-icon"
                dangerouslySetInnerHTML={{ __html: item.getIcon }}
            />
        );
    }
    if (!iconName) {
        return null;
    }
    return <Icon name={iconName} />;
}

export default function ContentBrowser() {
    const { config, setConfig } = useConfig();
    const { currentPath, setCurrentPath } = useCurrentPath();
    const pathCacheState = usePathCache();
    const { selectedItems, setSelectedItems } = useSelectedItems();
    const { selectedUids, setSelectedUids } = useSelectedUids();
    const { previewUids, setPreviewUids } = usePreviewUids();
    const { showContentBrowser, setShowContentBrowser } = useShowContentBrowser();

    const { levels, get } = useContentStore(config, pathCacheState);
    const [previewItem, setPreviewItem] = useState(null);
    const [showUpload, setShowUpload] = useState(false);
    const [keyboardNavInitialized, setKeyboardNavInitialized] = useState(false);
    const [shiftKey, setShiftKey] = useState(false);
    const [searchTerm, setSearchTerm] = useState(null);
    const [recentlyUsedList, setRecentlyUsedList] = useState(() =>
        recentlyUsedItems(true, config),
    );
    const defaultConfigMode = useRef(config.mode);
    const wrapperRef = useRef(null);
    const levelColumnsRef = useRef(null);
    useEffect(() => {
        const handleResize = () => {
            levelColumnsRef.current?.dispatchEvent(new CustomEvent("resize"));
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        setRecentlyUsedList(recentlyUsedItems(true, config));
    }, [config]);

    useEffect(() => {
        if (showContentBrowser) {
            setRecentlyUsedList(recentlyUsedItems(true, config));
        }
    }, [config, showContentBrowser]);

    const scrollToRight = useCallback(() => {
        const container = levelColumnsRef.current;
        if (container) {
            container.scrollTo({ left: container.scrollWidth + 100, behavior: "smooth" });
        }
    }, []);

    const updatePreview = useCallback(
        ({ data = null, uuid = null, action = "show" }) => {
            if (data && action === "show") {
                setPreviewItem(data);
                setPreviewUids([data.UID]);
            } else if (uuid && action === "add") {
                setPreviewUids((prev) => {
                    if (prev.includes(uuid)) {
                        return prev;
                    }
                    if (
                        config.maximumSelectionSize > 0 &&
                        prev.length >= config.maximumSelectionSize
                    ) {
                        return prev;
                    }
                    return [...prev, uuid];
                });
            } else if (uuid && action === "remove") {
                setPreviewUids((prev) => prev.filter((id) => id !== uuid));
            } else if (action === "clear") {
                setPreviewItem(null);
                setPreviewUids([]);
            }
        },
        [config.maximumSelectionSize, setPreviewUids],
    );

    const isBrowseable = useCallback(
        (item) =>
            item.is_folderish &&
            (!config.browseableTypes?.length ||
                config.browseableTypes.indexOf(item.portal_type) !== -1),
        [config.browseableTypes],
    );

    const isSelectable = useCallback(
        (item) =>
            !selectedUids.includes(item.UID) &&
            (!config.selectableTypes?.length ||
                config.selectableTypes.indexOf(item.portal_type) !== -1),
        [config.selectableTypes, selectedUids],
    );

    const showPreview = useCallback(
        (item) => {
            if (config.mode === "browse") {
                setPreviewUids([item.UID]);
                if (isBrowseable(item)) {
                    setCurrentPath(item.path);
                } else {
                    const pathParts = item.path.split("/");
                    const folderPath = pathParts.slice(0, pathParts.length - 1).join("/");
                    setCurrentPath(folderPath || "/");
                    updatePreview({ data: item });
                }
            } else {
                updatePreview({ data: item });
            }
            scrollToRight();
        },
        [config.mode, isBrowseable, scrollToRight, setCurrentPath, setPreviewUids, updatePreview],
    );

    const changePath = useCallback(
        (item) => {
            setShowUpload(false);
            updatePreview({ action: "clear" });
            if (item === "/" || item === config.rootPath) {
                setCurrentPath(config.rootPath);
                return;
            }
            showPreview(item);
        },
        [config.rootPath, setCurrentPath, setShowUpload, showPreview, updatePreview],
    );

    const addItem = useCallback(
        async (item) => {
            if (config.maximumSelectionSize === 1) {
                setSelectedItems([item]);
                setSelectedUids([item.UID]);
            } else {
                setSelectedItems((prev) => {
                    const next = [...prev];
                    if (!next.find((it) => it.UID === item.UID)) {
                        next.push(item);
                    }
                    return next;
                });
                setSelectedUids((prev) => [...new Set([...prev, item.UID])]);
            }
            updateRecentlyUsed(item, config);
            setRecentlyUsedList(recentlyUsedItems(true, config));
            updatePreview({ action: "clear" });
            setShowContentBrowser(false);
        },
        [config, setSelectedItems, setSelectedUids, setShowContentBrowser, updatePreview],
    );

    const addSelectedItems = useCallback(async () => {
        const previewItems = await get_items_from_uids(previewUids, config);
        setSelectedItems((prev) => {
            const existing = new Set(prev.map((it) => it.UID));
            const merged = [...prev];
            for (const item of previewItems) {
                if (!existing.has(item.UID)) {
                    merged.push(item);
                    existing.add(item.UID);
                }
            }
            return merged;
        });
        setSelectedUids((prev) => {
            const current = new Set(prev);
            for (const item of previewItems) {
                current.add(item.UID);
            }
            return Array.from(current);
        });
        updatePreview({ action: "clear" });
        setShowContentBrowser(false);
    }, [config, previewUids, setSelectedItems, setSelectedUids, setShowContentBrowser, updatePreview]);

    const selectRecentlyUsed = useCallback(
        (item) => {
            addItem(item);
        },
        [addItem],
    );

    const itemId = useCallback((item) => item.path?.split("/").pop() || "- no id -", []);

    const selectFavorite = useCallback(
        async (favorite) => {
            const response = await request({
                vocabularyUrl: config.vocabularyUrl,
                attributes: config.attributes,
                levelInfoPath: favorite.path,
            });
            if (!response.total) {
                window.alert(`${favorite.path} not found!`);
                return;
            }
            const item = response.results[0];
            if (!item.path) {
                item.path = config.rootPath;
            }
            changePath(item);
        },
        [changePath, config],
    );

    const closeBrowser = useCallback(() => {
        setConfig((prev) => ({ ...prev, mode: defaultConfigMode.current }));
        setShowContentBrowser(false);
        setKeyboardNavInitialized(false);
        updatePreview({ action: "clear" });
        setSearchTerm(null);
        setShowUpload(false);
        scrollToRight();
    }, [setConfig, setShowContentBrowser, scrollToRight, updatePreview]);

    useClickOutside(wrapperRef, () => {
        if (showContentBrowser) {
            closeBrowser();
        }
    });

    const itemInPath = useCallback(
        (item) => {
            const itemPath = item.path.split("/");
            const currPath = currentPath.split("/");
            let inPath = true;
            for (const idx in itemPath) {
                if (itemPath[idx] !== currPath[idx]) {
                    inPath = false;
                    break;
                }
            }
            return inPath;
        },
        [currentPath],
    );

    const searchItems = useCallback(
        async (value) => {
            if (defaultConfigMode.current === "browse") {
                setConfig((prev) => ({
                    ...prev,
                    mode: value ? "search" : "browse",
                }));
            }
            await get({
                path: currentPath,
                searchTerm: value,
                mode: value ? "search" : config.mode,
            });
            updatePreview({ action: "clear" });
            if (!value) {
                scrollToRight();
            }
        },
        [config.mode, currentPath, get, scrollToRight, setConfig, updatePreview],
    );

    const debouncedSearch = useMemo(
        () =>
            utils.debounce((value) => {
                searchItems(value);
            }, 300),
        [searchItems],
    );

    const handleSearchChange = useCallback(
        (event) => {
            const value = event.target.value;
            setSearchTerm(value);
            debouncedSearch(value);
        },
        [debouncedSearch],
    );

    const filterLevel = useCallback(
        async (val, levelPath) => {
            if (val !== "") {
                updatePreview({ action: "clear" });
            } else {
                scrollToRight();
            }
            await get({
                path: levelPath || currentPath,
                searchTerm: val,
                updateCache: true,
            });
        },
        [currentPath, get, scrollToRight, updatePreview],
    );

    const debouncedFilter = useMemo(
        () =>
            utils.debounce((value, levelPath) => {
                filterLevel(value, levelPath);
            }, 300),
        [filterLevel],
    );

    const loadMore = useCallback(
        (level) => {
            get({
                loadMorePath: level.path,
                page: (level.page || 1) + 1,
                searchTerm: level.searchTerm,
            });
        },
        [get],
    );

    const toggleLevelFilter = useCallback(
        (level) => {
            pathCacheState.setPathCache((prev) => ({
                ...prev,
                [level.path]: {
                    ...prev[level.path],
                    showFilter: !prev[level.path]?.showFilter,
                },
            }));
        },
        [pathCacheState],
    );

    useEffect(() => {
        if (showContentBrowser) {
            get({ path: currentPath });
        }
    }, [currentPath, get, showContentBrowser]);

    useEffect(() => {
        if (showContentBrowser) {
            scrollToRight();
        }
    }, [levels, scrollToRight, showContentBrowser]);

    useEffect(() => {
        if (!showContentBrowser) {
            return;
        }
        if (keyboardNavInitialized) {
            return;
        }
        const possible = [
            ...document.querySelectorAll(".levelColumn .inPath"),
            ...document.querySelectorAll(".levelColumn .selectedItem"),
        ];
        if (!possible.length) {
            const first = document.querySelector(".levelColumn .contentItem");
            if (first) {
                possible.push(first);
            }
        }
        if (possible.length) {
            setKeyboardNavInitialized(true);
            possible[0].focus();
        }
    }, [keyboardNavInitialized, showContentBrowser]);

    const handleKeyNavigation = useCallback(
        (item, event) => {
            const node = event.currentTarget;
            setShiftKey(event.shiftKey);
            if (event.key === "Escape") {
                closeBrowser();
            }
            if (event.key === "ArrowDown") {
                node?.nextElementSibling?.classList.contains("contentItem") &&
                    node.nextElementSibling.click();
            }
            if (event.key === "ArrowUp") {
                node?.previousElementSibling?.classList.contains("contentItem") &&
                    node.previousElementSibling.click();
            }
            if (event.key === "ArrowRight") {
                const currCol = event.target.closest(".levelColumn");
                const nxtCol = currCol?.nextElementSibling;
                if (nxtCol?.classList.contains("levelColumn")) {
                    nxtCol.querySelector(".contentItem")?.click();
                }
            }
            if (event.key === "ArrowLeft") {
                const currCol = event.target.closest(".levelColumn");
                const prevCol = currCol?.previousElementSibling;
                if (prevCol?.classList.contains("levelColumn")) {
                    prevCol.querySelector(".inPath")?.click();
                }
            }
            if (event.key === " ") {
                event.preventDefault();
                handleClickItem(item, event, true);
            }
            if (event.key === "Enter" && isSelectable(item)) {
                if (config.maximumSelectionSize === 1) {
                    addItem(item);
                } else {
                    addSelectedItems();
                }
            }
        },
        [addItem, addSelectedItems, closeBrowser, config.maximumSelectionSize, isSelectable],
    );

    const handleClickItem = useCallback(
        (item, event, fromKeyboard = false) => {
            if (!keyboardNavInitialized && !fromKeyboard) {
                setKeyboardNavInitialized(true);
            }
            const levelWrapper = event.currentTarget.closest(".levelItems");
            const prevSelection = levelWrapper
                ? levelWrapper.querySelectorAll(".selectedItem")
                : [];

            if (prevSelection.length && config.maximumSelectionSize !== 1) {
                if (shiftKey || event.shiftKey) {
                    const children = Array.from(levelWrapper.children);
                    let selecting = false;
                    for (const el of children) {
                        if ([item.UID, previewUids[0]].includes(el.dataset.uuid)) {
                            if (selecting) {
                                updatePreview({ uuid: el.dataset.uuid, action: "add" });
                                selecting = false;
                                continue;
                            }
                            selecting = true;
                        }
                        updatePreview({
                            uuid: el.dataset.uuid,
                            action: selecting ? "add" : "remove",
                        });
                    }
                    setShiftKey(false);
                } else if (event.metaKey || event.ctrlKey) {
                    updatePreview({
                        uuid: item.UID,
                        action: previewUids.includes(item.UID) ? "remove" : "add",
                    });
                } else {
                    prevSelection.forEach((el) => el.classList.remove("selectedItem"));
                    changePath(item);
                }
            } else {
                changePath(item);
            }

            event.currentTarget.focus();
            event.currentTarget.classList.add("selectedItem");
        },
        [changePath, config.maximumSelectionSize, previewUids, shiftKey, updatePreview],
    );

    if (!showContentBrowser) {
        return null;
    }

    return (
        <div className="content-browser-position-wrapper">
            <nav className="content-browser" ref={wrapperRef}>
                <div className="toolBar navbar">
                    <div className="input-group w-auto">
                        <input
                            type="text"
                            name="filter"
                            className="form-control form-control-sm"
                            value={searchTerm || ""}
                            onChange={handleSearchChange}
                        />
                        {searchTerm ? (
                            <button
                                className="btn btn-light btn-sm"
                                type="button"
                                onClick={() => {
                                    setSearchTerm("");
                                    searchItems("");
                                }}
                            >
                                <Icon name="x" />
                            </button>
                        ) : null}
                    </div>
                    <RecentlyUsed items={recentlyUsedList} onSelect={selectRecentlyUsed} />
                    <Favorites favorites={config.favorites} onSelect={selectFavorite} />
                    {config.uploadEnabled && config.mode === "browse" ? (
                        <div className="ms-2">
                            <button
                                type="button"
                                className="upload btn btn-outline-light btn-sm"
                                onClick={() => setShowUpload(true)}
                            >
                                <Icon name="upload" />
                                {_t("upload to ${current_path}", {
                                    current_path: currentPath,
                                })}
                            </button>
                        </div>
                    ) : null}
                    <button
                        className="btn btn-link text-white ms-auto"
                        onClick={(e) => {
                            e.preventDefault();
                            closeBrowser();
                        }}
                    >
                        <Icon name="x-circle" />
                    </button>
                </div>
                <div className="levelColumns" ref={levelColumnsRef}>
                    {levels.map((level, index) => (
                        <div className="levelColumn" key={level.path || index}>
                            <div className="levelToolbar">
                                <div className="selectLevel me-3">
                                    {level.selectable && config.maximumSelectionSize !== 1 ? (
                                        <button
                                            className="btn btn-xs btn-outline-primary d-flex align-items-center"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                addSelectedItems();
                                            }}
                                        >
                                            <Icon name="plus" />
                                            <span className="select-button-ellipsis">{level.Title}</span>
                                        </button>
                                    ) : null}
                                </div>
                                <div className="filterLevel">
                                    <button
                                        className="btn btn-outline-light btn-sm"
                                        type="button"
                                        onClick={() => toggleLevelFilter(level)}
                                    >
                                        <Icon name="filter" />
                                    </button>
                                    {pathCacheState.pathCache[level.path]?.showFilter ? (
                                        <input
                                            className="form-control form-control-sm"
                                            type="text"
                                            defaultValue={level.searchTerm || ""}
                                            onChange={(event) =>
                                                debouncedFilter(
                                                    event.target.value,
                                                    level.path,
                                                )
                                            }
                                        />
                                    ) : null}
                                </div>
                            </div>
                            <div className="levelItems">
                                {level.results?.map((item) => {
                                    const active = previewUids.includes(item.UID);
                                    const inPath = itemInPath(item);
                                    return (
                                        <div
                                            key={item.UID}
                                            data-uuid={item.UID}
                                            tabIndex={0}
                                            className={`contentItem${
                                                active ? " selectedItem" : ""
                                            }${inPath ? " inPath" : ""}`}
                                            onClick={(event) => handleClickItem(item, event)}
                                            onKeyDown={(event) => handleKeyNavigation(item, event)}
                                        >
                                            <div className="contentInfo">
                                                {item.getIcon ? (
                                                    <span
                                                        className="plone-icon"
                                                        dangerouslySetInnerHTML={{
                                                            __html: item.getIcon,
                                                        }}
                                                    />
                                                ) : (
                                                    <ItemIcon item={item} />
                                                )}
                                                <span className={!item.Title ? "id-only" : ""}>
                                                    {item.Title || itemId(item)}
                                                </span>
                                                {config.mode === "search" ? (
                                                    <>
                                                        <br />
                                                        <span className="small">{item.path}</span>
                                                    </>
                                                ) : null}
                                            </div>
                                            {isBrowseable(item) && config.mode === "browse" ? (
                                                <div className="browseSub">
                                                    <Icon name="arrow-right-circle" />
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                                {level.load_more ? (
                                    <div className="loadmore">
                                        <button
                                            type="button"
                                            className="btn btn-link"
                                            onClick={() => loadMore(level)}
                                        >
                                            <span className="spinner-border" role="status" />
                                        </button>
                                    </div>
                                ) : null}
                                {level.total === 0 ? (
                                    <div className="contentItem">
                                        <p>{_t("no results found")}</p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ))}
                    {previewItem?.UID && previewUids.length === 1 ? (
                        <div className="preview">
                            <div className="levelToolbar">
                                <div className="selectLevel me-3">
                                    {isSelectable(previewItem) ? (
                                        <button
                                            className="btn btn-xs btn-outline-primary d-flex align-items-center"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                addItem(previewItem);
                                            }}
                                        >
                                            <Icon name="plus" />
                                            <span className="select-button-ellipsis">
                                                {previewItem.Title}
                                            </span>
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                            <div className="info">
                                {previewItem.getIcon ? (
                                    <div className="previewImage">
                                        <img
                                            src={`${previewItem.getURL}/@@images/image/preview`}
                                            alt={previewItem.Title}
                                        />
                                    </div>
                                ) : (
                                    <div className="previewIcon">
                                        <Icon
                                            name={`contenttype/${previewItem.portal_type
                                                .toLowerCase()
                                                .replace(/[\\.|\s]/g, "-")}`}
                                        />
                                    </div>
                                )}
                                <dl>
                                    <dt>{_t("Id")}</dt>
                                    <dd>{itemId(previewItem)}</dd>
                                    <dt>{_t("Title")}</dt>
                                    <dd>{previewItem.Title}</dd>
                                    {previewItem.Description ? (
                                        <>
                                            <dt>{_t("Description")}</dt>
                                            <dd
                                                className="text-truncate"
                                                title={previewItem.Description}
                                            >
                                                {previewItem.Description}
                                            </dd>
                                        </>
                                    ) : null}
                                    {previewItem.created ? (
                                        <>
                                            <dt>{_t("created")}</dt>
                                            <dd>
                                                <time dateTime={previewItem.created}>
                                                    {formatDate(previewItem.created)}
                                                </time>
                                            </dd>
                                        </>
                                    ) : null}
                                    {previewItem.modified ? (
                                        <>
                                            <dt>{_t("modified")}</dt>
                                            <dd>
                                                <time dateTime={previewItem.modified}>
                                                    {formatDate(previewItem.modified)}
                                                </time>
                                            </dd>
                                        </>
                                    ) : null}
                                    {previewItem.review_state ? (
                                        <>
                                            <dt>{_t("review state")}</dt>
                                            <dd>{previewItem.review_state}</dd>
                                        </>
                                    ) : null}
                                </dl>
                            </div>
                        </div>
                    ) : null}
                </div>
                {config.maximumSelectionSize !== 1 && previewUids.length > 1 ? (
                    <div className="selectedItemsFooter">
                        <button
                            className="btn btn-primary"
                            onClick={(e) => {
                                e.preventDefault();
                                addSelectedItems();
                            }}
                        >
                            {_t("Select ${count} items", { count: previewUids.length })}
                        </button>
                    </div>
                ) : null}
                {showUpload ? (
                    <div className="upload-placeholder alert alert-info m-3">
                        {_t("Upload handling needs to be wired into the React implementation.")}
                    </div>
                ) : null}
            </nav>
        </div>
    );
}
