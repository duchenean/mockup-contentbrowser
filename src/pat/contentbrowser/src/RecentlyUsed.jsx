import React from "react";
import _t from "../../../core/i18n-wrapper";
import Icon from "./Icon.jsx";

export default function RecentlyUsed({ items = [], onSelect }) {
    if (!items.length) {
        return null;
    }

    return (
        <div className="recentlyUsed dropdown ms-2">
            <button
                type="button"
                className="recentlyUsed dropdown-toggle btn btn-outline-light btn-sm"
                data-bs-toggle="dropdown"
                aria-haspopup="true"
                aria-expanded="false"
            >
                <Icon name="grid-fill" />
                {_t("Recently Used")}
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
                {items
                    .slice()
                    .reverse()
                    .map((recentlyUsed) => (
                        <li key={recentlyUsed.UID}>
                            <a
                                href={recentlyUsed.getURL || "#"}
                                onClick={(event) => {
                                    event.preventDefault();
                                    onSelect?.(recentlyUsed);
                                }}
                                className="dropdown-item"
                            >
                                <Icon
                                    name={`contenttype/${recentlyUsed?.portal_type
                                        .toLowerCase()
                                        .replace(/[\\.|\s]/g, "-")}`}
                                />
                                {recentlyUsed.Title}
                            </a>
                        </li>
                    ))}
            </ul>
        </div>
    );
}
