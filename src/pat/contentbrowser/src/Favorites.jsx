import React from "react";
import _t from "../../../core/i18n-wrapper";
import Icon from "./Icon.jsx";

export default function Favorites({ favorites = [], onSelect }) {
    if (!favorites?.length) {
        return null;
    }

    return (
        <div className="favorites dropdown dropdown-menu-end ms-2">
            <button
                type="button"
                className="favorites dropdown-toggle btn btn-outline-light btn-sm"
                data-bs-toggle="dropdown"
                aria-haspopup="true"
                aria-expanded="false"
            >
                <Icon name="star-fill" />
                {_t("Favorites")}
            </button>
            <ul className="dropdown-menu">
                {favorites.map((favorite) => (
                    <li key={favorite.path}>
                        <a
                            className="dropdown-item"
                            href={favorite.path}
                            onClick={(event) => {
                                event.preventDefault();
                                onSelect?.(favorite);
                            }}
                        >
                            {favorite.title}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
