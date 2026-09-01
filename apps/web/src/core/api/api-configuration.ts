/** Public browser configuration required by the CasaStudio API boundary. */
export type ApiConfiguration = {
  readonly baseUrl: string;
};

/**
 * Reads and validates the browser-reachable API base URL from Vite's public environment.
 */
export function readApiConfiguration(environment: ImportMetaEnv): ApiConfiguration {
  const value = environment.VITE_API_BASE_URL?.trim();

  if (!value) {
    throw new Error("VITE_API_BASE_URL is required.");
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("VITE_API_BASE_URL must be an absolute URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VITE_API_BASE_URL must use HTTP or HTTPS.");
  }

  return {
    baseUrl: url.toString().replace(/\/$/, "")
  };
}
