import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { useCasaTranslation } from "../i18n";
import type { AuthClient, AuthState } from "./auth-client";

/**
 * Authentication state and actions available to CasaStudio components.
 */
export type AuthContextValue = AuthState & {
  readonly login: () => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly getAccessToken: () => Promise<string | null>;
};

/**
 * Props for the frontend authentication provider.
 */
export type AuthProviderProps = {
  readonly client: AuthClient;
  readonly children: ReactNode;
};

/** Authentication state used until the adapter initialization resolves. */
const initialAuthState: AuthState = {
  initialized: false,
  authenticated: false
};

/** Internal React context backing the public authentication hook. */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Initializes the browser authentication client before rendering application routes.
 */
export function AuthProvider({ client, children }: AuthProviderProps) {
  const { t } = useCasaTranslation("auth");
  const [state, setState] = useState<AuthState>(initialAuthState);
  const [initializationFailed, setInitializationFailed] = useState(false);

  useEffect(() => {
    let active = true;

    client
      .initialize()
      .then((session) => {
        if (active) {
          setState({ initialized: true, ...session });
        }
      })
      .catch(() => {
        if (active) {
          setInitializationFailed(true);
          setState({ initialized: true, authenticated: false });
        }
      });

    return () => {
      active = false;
    };
  }, [client]);

  const login = useCallback(() => client.login(), [client]);
  const logout = useCallback(() => client.logout(), [client]);
  const getAccessToken = useCallback(async () => {
    const token = await client.getAccessToken();

    if (token === null) {
      setState({ initialized: true, authenticated: false });
    }

    return token;
  }, [client]);
  const value = useMemo(
    () => ({ ...state, login, logout, getAccessToken }),
    [getAccessToken, login, logout, state]
  );

  return (
    <AuthContext.Provider value={value}>
      {!state.initialized ? (
        <AuthInitializationStatus />
      ) : initializationFailed ? (
        <Box sx={{ display: "grid", minHeight: "100vh", placeItems: "center", p: 2 }}>
          <Alert severity="error">{t("initialization.failed")}</Alert>
        </Box>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

/**
 * Returns the current frontend authentication state and supported actions.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}

/** Renders the application-wide authentication initialization state. */
function AuthInitializationStatus() {
  const { t } = useCasaTranslation("auth");

  return (
    <Box sx={{ display: "grid", minHeight: "100vh", placeItems: "center", p: 2 }}>
      <Stack role="status" spacing={1.5} sx={{ alignItems: "center" }}>
        <CircularProgress size={28} />
        <Typography variant="body2" color="text.secondary">
          {t("initialization.loading")}
        </Typography>
      </Stack>
    </Box>
  );
}
