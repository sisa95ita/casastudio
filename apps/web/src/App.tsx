import { GeometryPlaygroundPage } from "./geometry-playground/GeometryPlaygroundPage";
import "./styles.css";

/**
 * Props for the CasaStudio web application shell.
 */
export type AppProps = {
  readonly pathname?: string;
};

/**
 * Renders the current frontend route inside the existing Vite application.
 *
 * The app is still a development shell, so routing stays deliberately small:
 * `/geometry-playground` mounts the technical runtime viewer while `/` keeps
 * the foundation screen and a direct development link.
 */
export function App({ pathname }: AppProps) {
  const currentPath =
    pathname ?? (typeof window === "undefined" ? "/" : window.location.pathname);

  if (currentPath === "/geometry-playground") {
    return <GeometryPlaygroundPage />;
  }

  return (
    <main className="foundation-page">
      <h1>CasaStudio</h1>
      <p>Monorepo foundation ready.</p>
      <a href="/geometry-playground">Open Geometry Playground</a>
    </main>
  );
}
