import React from "react";
import Icon from "./Icon.jsx";

export default function SelectedItem({ item, unselectItem }) {
    return (
        <div
            className="selected-item border border-secondary-subtle rounded p-2 mb-1 bg-body-tertiary"
            data-uuid={item.UID}
        >
            <div className="item-info">
                <button
                    className="btn btn-link btn-sm link-secondary"
                    onClick={(event) => {
                        event.preventDefault();
                        unselectItem(item.UID);
                    }}
                >
                    <Icon name="x-circle" />
                </button>
                <div>
                    <span className="item-title">{item.Title}</span>
                    <br />
                    <span className="small">{item.path}</span>
                </div>
            </div>
            {item.getURL && (item.getIcon || item.portal_type === "Image") ? (
                <img src={`${item.getURL}/@@images/image/mini`} alt={item.Title} />
            ) : null}
        </div>
    );
}
