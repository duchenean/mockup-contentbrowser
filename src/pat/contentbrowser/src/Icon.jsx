import React from "react";
import {
    BsArrowRightCircle,
    BsCloudUpload,
    BsFileEarmarkText,
    BsFiles,
    BsFolder,
    BsGrid,
    BsGridFill,
    BsHouse,
    BsImage,
    BsList,
    BsLink45Deg,
    BsPlus,
    BsStarFill,
    BsX,
    BsXCircle,
} from "react-icons/bs";
import { guessIconName } from "./utils";

const fallbackIcons = {
    x: BsX,
    upload: BsCloudUpload,
    "x-circle": BsXCircle,
    house: BsHouse,
    plus: BsPlus,
    filter: BsList,
    grid: BsGrid,
    "grid-fill": BsGridFill,
    list: BsList,
    "arrow-right-circle": BsArrowRightCircle,
    files: BsFiles,
    "star-fill": BsStarFill,
};

const contentTypeIcons = {
    folder: BsFolder,
    image: BsImage,
    link: BsLink45Deg,
    file: BsFileEarmarkText,
    document: BsFileEarmarkText,
};

export default function Icon({ name, portalType, className, title }) {
    let IconComponent = fallbackIcons[name];
    if (!IconComponent && name?.startsWith("contenttype/")) {
        const key = guessIconName(name.replace("contenttype/", ""));
        IconComponent = contentTypeIcons[key] || BsFileEarmarkText;
    }
    if (!IconComponent && portalType) {
        IconComponent = contentTypeIcons[guessIconName(portalType)] || BsFileEarmarkText;
    }
    if (!IconComponent) {
        IconComponent = BsFileEarmarkText;
    }
    return <IconComponent className={className} title={title} aria-hidden="true" />;
}
