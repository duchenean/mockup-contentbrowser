import React from "react";
import Icon from "./Icon";

export default function Favorites({ favorites = [], onSelect }) {
    if (!favorites?.length) {
        return null;
    }

    return (
        <details className="cb-dropdown">
            <summary className="cb-button">
                <Icon name="star-fill" />
                <span>Favorites</span>
            </summary>
            <ul className="cb-dropdown-menu">
                {favorites.map((favorite) => (
                    <li key={favorite.path}>
                        <button
                            type="button"
                            className="cb-dropdown-item"
                            onClick={() => onSelect?.(favorite)}
                        >
                            {favorite.title || favorite.path}
                        </button>
                    </li>
                ))}
            </ul>
        </details>
    );
}
