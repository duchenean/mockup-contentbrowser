import { createContext, useContext } from "react";

export const ConfigContext = createContext();
export const CurrentPathContext = createContext();
export const PathCacheContext = createContext();
export const SelectedItemsContext = createContext();
export const SelectedUidsContext = createContext();
export const PreviewUidsContext = createContext();
export const ShowContentBrowserContext = createContext();

export function useConfig() {
    return useContext(ConfigContext);
}

export function useCurrentPath() {
    return useContext(CurrentPathContext);
}

export function usePathCache() {
    return useContext(PathCacheContext);
}

export function useSelectedItems() {
    return useContext(SelectedItemsContext);
}

export function useSelectedUids() {
    return useContext(SelectedUidsContext);
}

export function usePreviewUids() {
    return useContext(PreviewUidsContext);
}

export function useShowContentBrowser() {
    return useContext(ShowContentBrowserContext);
}
