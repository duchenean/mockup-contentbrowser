import { useCallback, useMemo, useRef, useState } from "react";
import { request, normalizePath } from "./utils";

function computePaths(config, path, maxDepth) {
    const rootPath = normalizePath(config.rootPath || "/");
    const rootParts = rootPath.replace(/^\/+/, "").split("/");
    const pathWithoutTrailing = normalizePath(path || rootPath);
    const physicalPath = pathWithoutTrailing.startsWith(rootPath)
        ? pathWithoutTrailing
        : `/${[...rootParts, ...pathWithoutTrailing.replace(/^\/+/, "").split("/")].join("/")}`;

    const pathParts = physicalPath.split("/").filter(Boolean);
    const cappedDepth = Math.min(pathParts.length, maxDepth || 999);
    const visible = pathParts.slice(pathParts.length - cappedDepth);
    const prefix = pathParts.slice(0, pathParts.length - cappedDepth).join("/");

    const paths = [];
    const hideRootPath = rootPath;

    for (let index = visible.length; index >= 0; index -= 1) {
        const slice = visible.slice(0, index).join("/");
        const segment = `${prefix ? `/${prefix}` : ""}${slice ? `/${slice}` : ""}` || "/";
        if (segment && !paths.includes(segment)) {
            paths.push(segment);
        }
        if (segment === rootPath) {
            break;
        }
    }

    return { paths, hideRootPath, physicalPath };
}

export default function useContentStore(config) {
    const [levels, setLevels] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const pathCacheRef = useRef({});
    const requestIdRef = useRef(0);

    const reset = useCallback(() => {
        pathCacheRef.current = {};
        setLevels([]);
    }, []);

    const load = useCallback(
        async (query) => {
            const response = await request({
                vocabularyUrl: config.vocabularyUrl,
                attributes: config.attributes,
                pageSize: config.pageSize,
                searchIndex: config.searchIndex,
                sortOn: config.sortOn,
                sortOrder: config.sortOrder,
                selectableTypes: config.selectableTypes,
                ...query,
            });
            return response;
        },
        [config],
    );

    const browse = useCallback(
        async (path, searchTerm, updateCache) => {
            const { paths, hideRootPath } = computePaths(config, path, config.maxDepth);
            const nextLevels = [];
            const cache = { ...pathCacheRef.current };

            for (const segment of paths) {
                const isFirstPath = segment === paths[0];
                let level = cache[segment];
                const shouldReload =
                    !level ||
                    (isFirstPath && typeof searchTerm === "string") ||
                    (isFirstPath && updateCache);

                if (shouldReload) {
                    const query = { path: segment };
                    if (isFirstPath && typeof searchTerm === "string" && searchTerm !== null) {
                        query.searchTerm = `*${searchTerm}*`;
                    }
                    level = await load(query);
                    level.page = 1;
                    level.path = segment;
                    level.displayPath = segment.replace(new RegExp(`^(${hideRootPath}|${config.rootPath})`), "") || "/";
                    level.searchTerm = searchTerm;
                    level.load_more = config.pageSize ? config.pageSize < level.total : false;

                    if (searchTerm === "") {
                        const info = await load({ levelInfoPath: segment, pageSize: null });
                        const data = info?.results?.[0];
                        if (data) {
                            level = {
                                ...level,
                                ...data,
                                selectable:
                                    !config.selectableTypes?.length ||
                                    config.selectableTypes.includes(data.portal_type),
                            };
                        }
                    }
                    if (cache[segment]?.showFilter) {
                        level.showFilter = cache[segment].showFilter;
                    }
                    cache[segment] = level;
                }
                nextLevels.unshift(level);
            }
            pathCacheRef.current = cache;
            setLevels(nextLevels);
        },
        [config, load],
    );

    const search = useCallback(
        async (searchTerm, page) => {
            const query = {
                searchPath: config.rootPath,
                searchTerm: searchTerm ? `*${searchTerm}*` : undefined,
                page,
            };
            const level = await load(query);
            level.page = page;
            level.searchTerm = searchTerm;
            level.load_more = config.pageSize ? config.pageSize * page < level.total : false;
            level.selectable = false;

            setLevels((prev) => {
                if (!prev.length || prev[0].searchTerm !== searchTerm) {
                    return [level];
                }
                const [first, ...rest] = prev;
                const merged = {
                    ...first,
                    load_more: level.load_more,
                    page,
                    results: [...(first.results || []), ...(level.results || [])],
                };
                return [merged, ...rest];
            });
        },
        [config, load],
    );

    const nextBatch = useCallback(
        async (path, page, searchTerm) => {
            const query = {
                path,
                page,
                searchTerm: searchTerm ? `*${searchTerm}*` : undefined,
            };
            const level = await load(query);
            setLevels((prev) =>
                prev.map((entry) => {
                    if (entry.path !== path) return entry;
                    return {
                        ...entry,
                        page,
                        load_more: config.pageSize ? config.pageSize * page < level.total : false,
                        results: [...(entry.results || []), ...(level.results || [])],
                    };
                }),
            );
        },
        [config.pageSize, load],
    );

    const get = useCallback(
        async ({ path, searchTerm = "", updateCache = false, loadMorePath = "", page = 1, mode = null }) => {
            const requestId = ++requestIdRef.current;
            setIsLoading(true);
            setError(null);
            try {
                if ((mode || config.mode) === "search") {
                    await search(searchTerm, page);
                } else if (loadMorePath) {
                    await nextBatch(loadMorePath, page, searchTerm);
                } else if (path) {
                    await browse(path, searchTerm, updateCache);
                }
            } catch (err) {
                if (requestId === requestIdRef.current) {
                    setError(err);
                }
            } finally {
                if (requestId === requestIdRef.current) {
                    setIsLoading(false);
                }
            }
        },
        [browse, config.mode, nextBatch, search],
    );

    return useMemo(
        () => ({
            levels,
            isLoading,
            error,
            get,
            reset,
            setLevels,
            pathCacheRef,
        }),
        [levels, isLoading, error, get, reset],
    );
}
