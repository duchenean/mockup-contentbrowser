import utils from "../../../core/utils.js";
import I18n from "../../../core/i18n.js";

export async function request({
    method = "GET",
    vocabularyUrl = null,
    attributes = [],
    path = null,
    uids = null,
    searchTerm = null,
    searchIndex = "SearchableText",
    searchPath = null,
    levelInfoPath = null,
    selectableTypes = [],
    pageSize = 100,
    sortOn = "sortable_title",
    sortOrder = "ascending",
    page = 1,
}) {
    let vocabQuery = {
        criteria: [],
    };
    if (path) {
        vocabQuery = {
            criteria: [
                {
                    i: "path",
                    o: "plone.app.querystring.operation.string.path",
                    v: `${path}::1`,
                },
            ],
            sort_on: sortOn,
            sort_order: sortOrder,
        };
    }
    if (levelInfoPath) {
        vocabQuery = {
            criteria: [
                {
                    i: "path",
                    o: "plone.app.querystring.operation.string.path",
                    v: `${levelInfoPath}::0`,
                },
            ],
        };
    }
    if (searchPath) {
        vocabQuery = {
            criteria: [
                {
                    i: "path",
                    o: "plone.app.querystring.operation.string.path",
                    v: searchPath,
                },
            ],
        };
        if (selectableTypes.length) {
            vocabQuery.criteria.push({
                i: "portal_type",
                o: "plone.app.querystring.operation.list.contains",
                v: selectableTypes,
            });
        }
    }
    if (uids) {
        vocabQuery = {
            criteria: [
                {
                    i: "UID",
                    o: "plone.app.querystring.operation.list.contains",
                    v: uids,
                },
            ],
        };
    }
    if (searchTerm) {
        vocabQuery.criteria.push({
            i: searchIndex,
            o: "plone.app.querystring.operation.string.contains",
            v: searchTerm,
        });
    }

    if (!vocabQuery.criteria.length) {
        return {
            results: [],
            total: 0,
        };
    }

    const urlQuery = JSON.stringify(vocabQuery);
    const urlParameters = JSON.stringify(attributes);
    const urlBatch = pageSize
        ? JSON.stringify({
              page,
              size: pageSize,
          })
        : "";

    let url = encodeURI(
        `${vocabularyUrl}${vocabularyUrl.indexOf("?") !== -1 ? "&" : "?"}query=${urlQuery}&attributes=${urlParameters}` +
            (urlBatch ? `&batch=${urlBatch}` : ""),
    );

    const headers = new Headers();
    headers.set("Accept", "application/json");

    const requestParams = {
        method,
        headers,
    };

    if (method === "POST" && url.indexOf("?") !== -1) {
        const urlParts = url.split("?");
        url = urlParts[0];
        const postData = urlParts[1];
        headers.set("Content-Type", "application/x-www-form-urlencoded");
        requestParams.body = postData;
    }

    const response = await fetch(url, requestParams);

    if (!response.ok) {
        return {
            results: [],
            total: 0,
            errors: response.errors,
        };
    }

    return await response.json();
}

export async function get_items_from_uids(uids, config) {
    if (!uids) {
        return [];
    }
    const selectedItemsFromUids = await request({
        method: "POST",
        vocabularyUrl: config.vocabularyUrl,
        attributes: config.attributes,
        uids,
        pageSize: null,
    });
    const results = (await selectedItemsFromUids?.results) || [];
    results.sort((a, b) => uids.indexOf(a.UID) - uids.indexOf(b.UID));
    return results;
}

export async function iconTag(iconName) {
    return utils.resolveIcon(iconName);
}

export function recentlyUsedItems(filterItems, config) {
    let ret = utils.storage.get(config.recentlyUsedKey) || [];
    ret = ret.slice(ret.length - 1000, ret.length);
    if (filterItems && config?.selectableTypes.length) {
        ret = ret.filter((it) => config.selectableTypes.indexOf(it.portal_type) !== -1);
    }
    const max = parseInt(config.recentlyUsedMaxItems, 20);
    if (max) {
        ret = ret.slice(ret.length - max, ret.length);
    }
    return ret;
}

export function updateRecentlyUsed(item, config) {
    if (!config.recentlyUsed) {
        return;
    }
    const recentlyUsed = recentlyUsedItems(false, config);
    const alreadyPresent = recentlyUsed.find((it) => it.UID === item.UID);
    if (alreadyPresent) {
        recentlyUsed.splice(recentlyUsed.indexOf(alreadyPresent), 1);
    }
    recentlyUsed.push(item);
    utils.storage.set(config.recentlyUsedKey, recentlyUsed);
}

export function formatDate(dateval) {
    const d = Date.parse(dateval);
    const i18n = new I18n();
    return new Date(d).toLocaleString(i18n.currentLanguage.replace("_", "-"));
}
