import React, { useContext, useEffect, useMemo, useRef } from "react";
import Sortable from "sortablejs";
import SelectedItem from "./SelectedItem";
import {
    ConfigContext,
    SelectedItemsContext,
    SelectedUidsContext,
    ShowBrowserContext,
} from "./contexts";
import { reorder } from "./utils";

export default function SelectedItems() {
    const [config] = useContext(ConfigContext);
    const [selectedItems, setSelectedItems] = useContext(SelectedItemsContext);
    const [, setSelectedUids] = useContext(SelectedUidsContext);
    const [, setShowBrowser] = useContext(ShowBrowserContext);
    const listRef = useRef(null);

    useEffect(() => {
        setSelectedUids(selectedItems.map((item) => item.UID));
    }, [selectedItems, setSelectedUids]);

    useEffect(() => {
        if (!listRef.current || config.maximumSelectionSize === 1 || selectedItems.length < 2) {
            return undefined;
        }
        const sortable = Sortable.create(listRef.current, {
            animation: 150,
            onEnd: ({ oldIndex, newIndex }) => {
                if (oldIndex === newIndex) return;
                setSelectedItems((items) => reorder(items, oldIndex, newIndex));
            },
        });
        return () => sortable.destroy();
    }, [selectedItems.length, config.maximumSelectionSize, setSelectedItems]);

    const buttonLabel = useMemo(
        () => (config.uploadEnabled ? "Select or Upload" : "Select"),
        [config.uploadEnabled],
    );

    return (
        <div className="selected-items-wrapper" style={{ width: config.width || "auto" }}>
            <div
                className="selected-items"
                onClick={() => setShowBrowser(selectedItems.length ? false : true)}
            >
                <div className="selected-items-list" ref={listRef}>
                    {selectedItems.map((item) => (
                        <SelectedItem key={item.UID} item={item} onRemove={(uid) => {
                            setSelectedItems((items) => items.filter((it) => it.UID !== uid));
                        }} />
                    ))}
                    {!selectedItems.length && <p className="muted">No items selected.</p>}
                </div>
            </div>
            <button
                type="button"
                className="cb-primary-button"
                onClick={() => setShowBrowser(true)}
            >
                {buttonLabel}
            </button>
        </div>
    );
}
