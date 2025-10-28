import React, { useMemo } from "react";
import Icon from "./Icon";
import { recentlyUsedItems } from "./utils";

export default function RecentlyUsed({ config, onSelect }) {
    const items = useMemo(() => recentlyUsedItems(true, config), [config]);

    if (!config.recentlyUsed || !items.length) {
        return null;
    }

    return (
        <details className="cb-dropdown">
            <summary className="cb-button">
                <Icon name="grid-fill" />
                <span>Recently Used</span>
            </summary>
            <ul className="cb-dropdown-menu">
                {[...items].reverse().map((item) => (
                    <li key={item.UID}>
                        <button
                            type="button"
                            className="cb-dropdown-item"
                            onClick={() => onSelect?.(item)}
                        >
                            <Icon portalType={item.portal_type} />
                            <span>{item.Title || item.path}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </details>
    );
}
