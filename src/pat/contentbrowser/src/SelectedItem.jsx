import React from "react";
import Icon from "./Icon";

export default function SelectedItem({ item, onRemove }) {
    return (
        <div className="selected-item" data-uuid={item.UID}>
            <div className="item-info">
                <button type="button" className="cb-button-link" onClick={() => onRemove(item.UID)}>
                    <Icon name="x-circle" />
                </button>
                <div>
                    <span className="item-title">{item.Title || item.path}</span>
                    <span className="item-path">{item.path}</span>
                </div>
            </div>
            {item.getURL && (item.getIcon || item.portal_type === "Image") ? (
                <img src={`${item.getURL}/@@images/image/mini`} alt={item.Title || item.path} />
            ) : null}
        </div>
    );
}
