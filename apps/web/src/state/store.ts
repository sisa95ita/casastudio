import { configureStore } from "@reduxjs/toolkit";

import { viewerReducer } from "./viewer-slice";

/** Creates the typed CasaStudio Redux store for local application state. */
export function createAppStore() {
  return configureStore({
    reducer: {
      viewer: viewerReducer
    }
  });
}

/** Browser application store shared across the single mounted React root. */
export const appStore = createAppStore();

/** Root state inferred from the application store. */
export type RootState = ReturnType<typeof appStore.getState>;

/** Dispatch function inferred from the application store. */
export type AppDispatch = typeof appStore.dispatch;

/** Concrete application store type used by provider seams and tests. */
export type AppStore = ReturnType<typeof createAppStore>;
