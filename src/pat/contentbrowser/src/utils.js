import { useEffect } from "react";

/**
 * Minimal local storage helper that works in both browser and test
 * environments.
 */
const storage = {
    get(key) {
        if (typeof window === "undefined" || !window.localStorage) {
            return [];
        }
        try {
            const raw = window.localStorage.getItem(key);
            return raw ? JSON.parse(raw) : [];
        } catch (err) {
            console.warn("pat-contentbrowser: failed to read localStorage", err);
            return [];
        }
    },
    set(key, value) {
        if (typeof window === "undefined" || !window.localStorage) {
            return;
        }
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
            console.warn("pat-contentbrowser: failed to write localStorage", err);
        }
    },
};

function ensureURL(url) {
    if (!url) {
        return new URL("/", "http://localhost");
    }
    try {
        return new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    } catch (err) {
        return new URL("/", "http://localhost");
    }
}

function buildQueryURL({
    vocabularyUrl,
    attributes,
    path,
    uids,
    searchTerm,
    searchIndex,
    searchPath,
    levelInfoPath,
    selectableTypes,
    pageSize,
    sortOn,
    sortOrder,
    page,
}) {
    const baseURL = ensureURL(vocabularyUrl);
    const query = {
        criteria: [],
    };

    if (path) {
        query.criteria.push({
            i: "path",
            o: "plone.app.querystring.operation.string.path",
            v: `${path}::1`,
        });
    }

    if (levelInfoPath) {
        query.criteria = [
            {
                i: "path",
                o: "plone.app.querystring.operation.string.path",
                v: `${levelInfoPath}::0`,
            },
        ];
    }

    if (searchPath) {
        query.criteria.push({
            i: "path",
            o: "plone.app.querystring.operation.string.path",
            v: searchPath,
        });
        if (selectableTypes && selectableTypes.length) {
            query.criteria.push({
                i: "portal_type",
                o: "plone.app.querystring.operation.list.contains",
                v: selectableTypes,
            });
        }
    }

    if (uids) {
        query.criteria = [
            {
                i: "UID",
                o: "plone.app.querystring.operation.list.contains",
                v: uids,
            },
        ];
    }

    if (searchTerm) {
        query.criteria.push({
            i: searchIndex || "SearchableText",
            o: "plone.app.querystring.operation.string.contains",
            v: searchTerm,
        });
    }

    if (!query.criteria.length) {
        return null;
    }

    const params = new URLSearchParams();
    params.set("query", JSON.stringify(query));
    params.set("attributes", JSON.stringify(attributes || []));
    if (pageSize) {
        params.set("batch", JSON.stringify({ page, size: pageSize }));
    }
    if (!path && !levelInfoPath) {
        if (sortOn) params.set("sort_on", sortOn);
        if (sortOrder) params.set("sort_order", sortOrder);
    }
    baseURL.search = params.toString();
    return baseURL;
}

export async function request({
    method = "GET",
    vocabularyUrl,
    attributes = [],
    path,
    uids,
    searchTerm,
    searchIndex = "SearchableText",
    searchPath,
    levelInfoPath,
    selectableTypes = [],
    pageSize = 100,
    sortOn = "sortable_title",
    sortOrder = "ascending",
    page = 1,
}) {
    const url = buildQueryURL({
        vocabularyUrl,
        attributes,
        path,
        uids,
        searchTerm,
        searchIndex,
        searchPath,
        levelInfoPath,
        selectableTypes,
        pageSize,
        sortOn,
        sortOrder,
        page,
    });

    if (!url) {
        return { results: [], total: 0 };
    }

    const headers = new Headers();
    headers.set("Accept", "application/json");
    let body;

    if (method === "POST") {
        headers.set("Content-Type", "application/x-www-form-urlencoded");
        body = url.searchParams.toString();
        url.search = "";
    }

    const response = await fetch(url.toString(), {
        method,
        headers,
        body,
    });

    if (!response.ok) {
        const error = new Error(`Request failed with status ${response.status}`);
        error.status = response.status;
        throw error;
    }

    return await response.json();
}

export async function getItemsFromUids(uids, config) {
    if (!uids || !uids.length) {
        return [];
    }
    const response = await request({
        method: "POST",
        vocabularyUrl: config.vocabularyUrl,
        attributes: config.attributes,
        uids,
        pageSize: null,
    });
    const results = response?.results || [];
    results.sort((a, b) => uids.indexOf(a.UID) - uids.indexOf(b.UID));
    return results;
}

export function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    const locale = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en";
    return date.toLocaleString(locale);
}

export function recentlyUsedItems(filterSelectable, config) {
    if (!config.recentlyUsed || !config.recentlyUsedKey) {
        return [];
    }
    let items = storage.get(config.recentlyUsedKey) || [];
    items = items.slice(Math.max(items.length - 1000, 0));
    if (filterSelectable && config.selectableTypes?.length) {
        items = items.filter((item) => config.selectableTypes.includes(item.portal_type));
    }
    const limit = parseInt(config.recentlyUsedMaxItems, 10);
    if (limit) {
        items = items.slice(Math.max(items.length - limit, 0));
    }
    return items;
}

export function updateRecentlyUsed(item, config) {
    if (!config.recentlyUsed || !config.recentlyUsedKey || !item) {
        return;
    }
    const items = recentlyUsedItems(false, config);
    const existingIndex = items.findIndex((it) => it.UID === item.UID);
    if (existingIndex !== -1) {
        items.splice(existingIndex, 1);
    }
    items.push(item);
    storage.set(config.recentlyUsedKey, items);
}

export function debounce(fn, delay = 300) {
    let handle;
    return (...args) => {
        window.clearTimeout(handle);
        handle = window.setTimeout(() => fn(...args), delay);
    };
}

export function useClickOutside(ref, handler) {
    useEffect(() => {
        const listener = (event) => {
            if (!ref.current || ref.current.contains(event.target)) {
                return;
            }
            handler(event);
        };
        document.addEventListener("mousedown", listener, true);
        document.addEventListener("touchstart", listener, true);
        return () => {
            document.removeEventListener("mousedown", listener, true);
            document.removeEventListener("touchstart", listener, true);
        };
    }, [ref, handler]);
}

export function clampPageSize(total, pageSize, page) {
    const maxPages = pageSize ? Math.ceil(total / pageSize) : 1;
    return Math.min(page, maxPages);
}

export function normalizePath(value) {
    if (!value) return "/";
    if (value === "/") return "/";
    return value.replace(/\/+$/, "");
}

export function isFolderish(item) {
    return !!item?.is_folderish;
}

export function itemIdentifier(item) {
    if (!item || !item.path) {
        return "-";
    }
    const parts = item.path.split("/");
    return parts[parts.length - 1] || parts[parts.length - 2] || parts[0];
}

export function reorder(list, startIndex, endIndex) {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
}

export function flattenPreview(items) {
    return items.map((item) => item.UID);
}

export function ensureArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return [value];
}

export function guessIconName(portal_type = "") {
    const type = portal_type.toLowerCase();
    if (type.includes("folder")) return "folder";
    if (type.includes("image")) return "image";
    if (type.includes("link")) return "link";
    if (type.includes("file")) return "file";
    return "document";
}

export function createBatchInfo(level, pageSize) {
    return {
        hasMore: pageSize ? level.total > pageSize * (level.page || 1) : false,
        nextPage: (level.page || 1) + 1,
    };
}

export default {
    request,
    getItemsFromUids,
    formatDate,
    recentlyUsedItems,
    updateRecentlyUsed,
    debounce,
    useClickOutside,
    clampPageSize,
    normalizePath,
    isFolderish,
    itemIdentifier,
    reorder,
    flattenPreview,
    ensureArray,
    guessIconName,
    createBatchInfo,
};
