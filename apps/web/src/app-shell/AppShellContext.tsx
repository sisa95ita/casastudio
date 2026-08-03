import type { ReactNode } from "react";
import { createContext, useContext, useEffect } from "react";

/**
 * Route-owned content that is projected into the shared application shell.
 *
 * The shell accepts only title, inspector, status, and a small header accessory
 * so this foundation can support nested routes without inventing docking,
 * plugin, or editor view-model systems before CasaStudio has editing commands.
 */
export type AppShellContent = {
  readonly title: string;
  readonly breadcrumb?: string;
  readonly headerAccessory?: ReactNode;
  readonly inspector?: ReactNode;
  readonly status?: ReactNode;
};

/**
 * Mutable shell slot API used internally by route pages.
 */
export type AppShellContentController = {
  readonly setContent: (content: AppShellContent) => void;
  readonly resetContent: () => void;
};

/**
 * Minimal shell content used before a route registers its own localized slots.
 */
export const defaultAppShellContent: AppShellContent = {
  title: "",
  breadcrumb: undefined,
  status: undefined
};

/**
 * Context through which nested routes register route-specific shell slots.
 */
export const AppShellContentContext = createContext<AppShellContentController | undefined>(
  undefined
);

/**
 * Registers route-specific shell slots for the active nested route.
 *
 * The registration is intentionally effect-based and optional: standalone
 * component tests can render route pages without the shell, while the browser
 * app keeps the global header, inspector, and status bar synchronized with the
 * current route.
 */
export function useAppShellContent(content: AppShellContent): void {
  const controller = useContext(AppShellContentContext);

  useEffect(() => {
    if (!controller) {
      return;
    }

    controller.setContent(content);

    return () => {
      controller.resetContent();
    };
  }, [content, controller]);
}
