import { useCallback, useState } from "react";
import { request } from "./utils";

export default function useContentStore(config, pathCacheState) {
    const { pathCache, setPathCache } = pathCacheState;
    const [levels, setLevels] = useState([]);

    const load = useCallback(
        async (query) => {
            const defaults = {
                vocabularyUrl: config.vocabularyUrl,
                attributes: config.attributes,
                pageSize: config.pageSize,
                searchIndex: config.searchIndex,
                sortOn: config.sortOn,
                sortOrder: config.sortOrder,
            };
            const prepared = {
                ...defaults,
                ...query,
            };
            if (config.selectableTypes?.length) {
                prepared.selectableTypes = config.selectableTypes;
            }
            try {
                return await request(prepared);
            } catch (e) {
                console.debug(`Could not load data from backend. ${e}`);
                return { error: "Could not load data from backend." };
            }
        },
        [config],
    );

    const browse = useCallback(
        async (path, searchTerm, updateCache) => {
            const rootPath = config.rootPath || "";
            const rootPathParts = rootPath.replace(/^\/+/, "").split("/");
            let physicalPath = path;
            let hideRootPath = rootPath;

            if (physicalPath && !physicalPath.startsWith(rootPath)) {
                const pathParts = physicalPath.replace(/^\/+/, "").split("/");
                let overlapIdx = 0;
                for (; overlapIdx < rootPathParts.length; overlapIdx++) {
                    if (rootPathParts[overlapIdx] === pathParts[0]) {
                        break;
                    }
                }
                hideRootPath =
                    "/" + rootPathParts.filter((it) => !pathParts.includes(it)).join("/");
                physicalPath =
                    "/" +
                    rootPathParts
                        .slice(0, overlapIdx)
                        .concat(pathParts)
                        .join("/");
            }

            const paths = [];
            const parts = (physicalPath || "").split("/");
            const maxDepth = Math.min(parts.length, config.maxDepth || 999);
            const partsToShow = parts.slice(parts.length - maxDepth, parts.length);
            const partsToHide = parts.slice(0, parts.length - maxDepth);
            const pathPrefix = partsToHide.join("/");

            const working = [...partsToShow];
            while (working.length > 0) {
                let subPath = working.join("/").replace(/^\//, "");
                const popped = working.pop();
                subPath = pathPrefix + (popped !== "" ? `/${subPath}` : "");
                if (subPath && !paths.includes(subPath)) {
                    paths.push(subPath);
                }
                if (subPath === rootPath) {
                    break;
                }
            }

            const cached = pathCache || {};
            const collected = [];
            let pathCounter = 0;

            for (const p of paths) {
                pathCounter += 1;
                const isFirstPath = pathCounter === 1;
                let level = {};
                const hasCached = Object.prototype.hasOwnProperty.call(cached, p);
                if (
                    !hasCached ||
                    (isFirstPath && searchTerm) ||
                    (isFirstPath && updateCache)
                ) {
                    const query = { path: p };
                    if (isFirstPath && searchTerm) {
                        query.searchTerm = `*${searchTerm}*`;
                    }
                    level = await load(query);
                    level.load_more = config.pageSize < level.total;
                    level.page = 1;
                    level.path = p;
                    level.searchTerm = searchTerm;
                    level.displayPath =
                        p.replace(new RegExp(`^(${hideRootPath}|${rootPath})`), "") ||
                        "/";

                    if (searchTerm === "") {
                        const levelInfo = await load({ levelInfoPath: p });
                        if (levelInfo.total) {
                            const info = levelInfo.results[0];
                            level.UID = info.UID;
                            level.Title = info.Title;
                            level.portal_type = info.portal_type;
                            level.getIcon = info.getIcon;
                            level.selectable =
                                !config.selectableTypes?.length ||
                                config.selectableTypes.indexOf(info.portal_type) !== -1;
                        }
                    }

                    if (hasCached) {
                        level.showFilter = cached[p].showFilter || level.showFilter;
                    }

                    setPathCache((prev) => ({
                        ...prev,
                        [p]: level,
                    }));
                } else {
                    level = cached[p];
                }
                collected.unshift(level);
            }
            setLevels(collected);
        },
        [config, load, pathCache, setPathCache],
    );

    const search = useCallback(
        async (searchTerm, page) => {
            const query = {
                searchPath: config.rootPath,
                page,
            };
            if (searchTerm) {
                query.searchTerm = `*${searchTerm}*`;
            }
            const level = await load(query);
            level.searchTerm = searchTerm;
            const hasMore = page * config.pageSize < level.total;
            setLevels((prev) => {
                if (!prev.length || prev[0].searchTerm !== searchTerm) {
                    level.load_more = hasMore;
                    level.selectable = false;
                    level.page = page;
                    return [level];
                }
                const next = [...prev];
                next[0] = {
                    ...next[0],
                    load_more: hasMore,
                    page,
                    results: [...next[0].results, ...level.results],
                };
                return next;
            });
        },
        [config, load],
    );

    const nextBatch = useCallback(
        async (path, page, searchTerm) => {
            const query = {
                path,
                page,
            };
            if (searchTerm) {
                query.searchTerm = `*${searchTerm}*`;
            }
            const level = await load(query);
            setLevels((prev) =>
                prev.map((item) => {
                    if (item.path !== path) {
                        return item;
                    }
                    return {
                        ...item,
                        page,
                        load_more: page * config.pageSize < level.total,
                        results: [...item.results, ...level.results],
                    };
                }),
            );
        },
        [config, load],
    );

    const get = useCallback(
        async ({
            path = "",
            searchTerm = "",
            updateCache = false,
            loadMorePath = "",
            page = 1,
            mode = null,
        }) => {
            const effectiveMode = mode ?? config.mode;
            if (effectiveMode === "search") {
                await search(searchTerm, page);
            } else if (loadMorePath) {
                const cached = pathCache[loadMorePath];
                if (!cached || page > cached.page) {
                    await nextBatch(loadMorePath, page, searchTerm);
                }
            } else if (path) {
                await browse(path, searchTerm, updateCache);
            }
        },
        [browse, config.mode, nextBatch, pathCache, search],
    );

    return { levels, setLevels, get };
}
