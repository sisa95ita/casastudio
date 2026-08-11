import { useDispatch, useSelector } from "react-redux";

import type { AppDispatch, RootState } from "./store";

/** Typed Redux dispatch hook for CasaStudio local application actions. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/** Typed Redux selector hook for CasaStudio local application state. */
export const useAppSelector = useSelector.withTypes<RootState>();
