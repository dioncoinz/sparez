import type { CookieOptionsWithName } from "@supabase/ssr";

export const AUTH_COOKIE_NAME = "sparez-auth";

export const authCookieOptions: CookieOptionsWithName = {
  name: AUTH_COOKIE_NAME,
  path: "/",
  sameSite: "lax",
};

export function isSparezAuthCookie(name: string) {
  if (name === AUTH_COOKIE_NAME || name.startsWith(`${AUTH_COOKIE_NAME}.`)) return true;
  try {
    const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
    const legacyName = `sb-${projectRef}-auth-token`;
    return name === legacyName || name.startsWith(`${legacyName}.`);
  } catch {
    return false;
  }
}
