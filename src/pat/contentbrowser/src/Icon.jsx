import React, { useEffect, useState } from "react";
import { iconTag } from "./utils";

export default function Icon({ name, className, ...rest }) {
    const [markup, setMarkup] = useState(null);

    useEffect(() => {
        let active = true;
        async function loadIcon() {
            const html = await iconTag(name);
            if (active) {
                setMarkup(html);
            }
        }
        if (name) {
            loadIcon();
        } else {
            setMarkup(null);
        }
        return () => {
            active = false;
        };
    }, [name]);

    if (!markup) {
        return null;
    }

    return (
        <span
            className={className}
            dangerouslySetInnerHTML={{ __html: markup }}
            {...rest}
        />
    );
}
