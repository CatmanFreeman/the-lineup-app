import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";


/**
 * RequireAuth
 *
 * PURPOSE
 * - Blocks access to protected routes until auth state is resolved.
 *
 * BEHAVIOR
 * - While auth is loading: render a neutral loading state (NO redirect).
 * - If unauthenticated: redirect to /login and preserve attempted path.
 * - If authenticated: render children normally.
 */

export default function RequireAuth({ children }) {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  /* ------------------------------------------------------------ */
  /* AUTH STATE: LOADING                                          */
  /* ------------------------------------------------------------ */
  if (loading) {
    return (
      <div
        style={{
          padding: 18,
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
          color: "#aaa",
        }}
      >
        Loading…
      </div>
    );
  }

  /* ------------------------------------------------------------ */
  /* AUTH STATE: NOT LOGGED IN                                    */
  /* ------------------------------------------------------------ */
  if (!currentUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  /* ------------------------------------------------------------ */
  /* AUTH STATE: AUTHENTICATED                                   */
  /* ------------------------------------------------------------ */
  return <>{children}</>;
}
