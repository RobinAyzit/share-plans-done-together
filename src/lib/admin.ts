/** Admin-only insights — only this account can open the dashboard. */
export const ADMIN_EMAIL = 'bynrnworld@gmail.com';

export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return email.trim().toLowerCase() === ADMIN_EMAIL;
}
