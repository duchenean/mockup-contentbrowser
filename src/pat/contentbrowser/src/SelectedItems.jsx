import React, { useEffect, useMemo, useRef, useState } from "react";
import Sortable from "sortablejs";
import plone_registry from "@plone/registry";
import _t from "../../../core/i18n-wrapper";
import { get_items_from_uids } from "./utils.js";
import {
    useConfig,
    useSelectedItems,
    useSelectedUids,
    useShowContentBrowser,
} from "./context";
import SelectedItem from "./SelectedItem.jsx";

export default function SelectedItems() {
    const { config } = useConfig();
    const { selectedItems, setSelectedItems } = useSelectedItems();
    const { setSelectedUids } = useSelectedUids();
    const { setShowContentBrowser } = useShowContentBrowser();
    const containerRef = useRef(null);
    const listRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [registeredComponent, setRegisteredComponent] = useState(null);

    const selectedItemsNode = useMemo(() => {
        if (!config.fieldId) {
            return null;
        }
        return document.getElementById(config.fieldId);
    }, [config.fieldId]);

    useEffect(() => {
        let active = true;
        async function loadComponent() {
            let componentInfo = null;
            if (config.componentRegistryKeys?.selectedItem) {
                componentInfo = plone_registry.getComponent(
                    config.componentRegistryKeys.selectedItem,
                );
            }
            if (!componentInfo?.component) {
                componentInfo = plone_registry.getComponent(
                    "pat-contentbrowser.SelectedItem",
                );
            }
            const component = componentInfo?.component || SelectedItem;
            if (active) {
                setRegisteredComponent(component);
            }
        }
        loadComponent();
        return () => {
            active = false;
        };
    }, [config.componentRegistryKeys]);

    useEffect(() => {
        let cancelled = false;
        async function initializeSelectedItemsStore() {
            const initialValue = config.selection?.length
                ? config.selection
                : selectedItemsNode?.value
                  ? selectedItemsNode.value.split(config.separator)
                  : [];

            if (!initialValue.length) {
                if (!cancelled) {
                    setLoading(false);
                }
                return;
            }

            const items = await get_items_from_uids(initialValue, config);
            if (!cancelled) {
                setSelectedItems(items);
                setSelectedUids(items.map((x) => x.UID));
                setLoading(false);
            }
        }
        initializeSelectedItemsStore();
        return () => {
            cancelled = true;
        };
    }, [config, selectedItemsNode, setSelectedItems, setSelectedUids]);

    useEffect(() => {
        if (!selectedItemsNode) {
            return;
        }
        const nodeValue = selectedItems.map((x) => x.UID).join(config.separator);
        selectedItemsNode.value = nodeValue;
        const changeEvent = new Event("change", { bubbles: true });
        selectedItemsNode.dispatchEvent(changeEvent);
    }, [config.separator, selectedItems, selectedItemsNode]);

    useEffect(() => {
        if (
            config.maximumSelectionSize === 1 ||
            selectedItems.length <= 1 ||
            !listRef.current
        ) {
            return undefined;
        }
        const sortable = Sortable.create(listRef.current, {
            draggable: "> div",
            animation: 200,
            onEnd: () => {
                const uuids = Array.from(listRef.current.querySelectorAll(".selected-item")).map(
                    (el) => el.dataset.uuid,
                );
                setSelectedItems((prev) => {
                    const itemsByUid = new Map(prev.map((item) => [item.UID, item]));
                    return uuids
                        .map((uid) => itemsByUid.get(uid))
                        .filter(Boolean);
                });
                setSelectedUids(uuids);
            },
        });
        return () => sortable.destroy();
    }, [config.maximumSelectionSize, selectedItems.length, setSelectedItems, setSelectedUids]);

    const unselectItem = (uid) => {
        setSelectedItems((prev) => prev.filter((x) => x.UID !== uid));
        setSelectedUids((prev) => prev.filter((id) => id !== uid));
    };

    const Component = registeredComponent || SelectedItem;

    return (
        <div
            className="content-browser-selected-items-wrapper"
            style={{ width: config.width || "auto" }}
            ref={containerRef}
        >
            <div
                className="content-browser-selected-items"
                ref={listRef}
                onClick={() =>
                    setShowContentBrowser(selectedItems.length ? false : true)
                }
            >
                {loading ? (
                    <p>{_t("loading selected items")}</p>
                ) : selectedItems.length ? (
                    selectedItems.map((item) => (
                        <Component key={item.UID} item={item} unselectItem={unselectItem} />
                    ))
                ) : null}
            </div>
            <a
                className="btn btn-primary"
                href="#"
                style={{ borderRadius: "0 var(--bs-border-radius) var(--bs-border-radius) 0" }}
                onClick={(event) => {
                    event.preventDefault();
                    setShowContentBrowser(true);
                }}
            >
                {config.uploadEnabled ? _t("Select or Upload") : _t("Select")}
            </a>
        </div>
    );
}
