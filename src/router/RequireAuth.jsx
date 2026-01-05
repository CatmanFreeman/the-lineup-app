import React from "react";

/**
 * RequireAuth — DISABLED (UI BUILD MODE)
 *
 * This file is intentionally neutralized so it cannot:
 * - redirect
 * - crash routing
 * - block dashboard development
 *
 * DO NOT add logic here until UI is finished.
 */
export default function RequireAuth({ children }) {
  return <>{children}</>;
}
