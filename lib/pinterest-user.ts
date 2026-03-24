/** GET https://api.pinterest.com/v5/user_account — requires `user_accounts:read` scope. */
export type PinterestUserAccount = {
  id?: string;
  username?: string;
  profile_image?: string;
  account_type?: string;
  business_name?: string | null;
  website_url?: string | null;
};

export type PinterestUserAccountResult =
  | { ok: true; account: PinterestUserAccount }
  | { ok: false; status: number };

export async function fetchPinterestUserAccount(
  accessToken: string
): Promise<PinterestUserAccountResult> {
  const r = await fetch('https://api.pinterest.com/v5/user_account', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    return { ok: false, status: r.status };
  }
  const data = (await r.json()) as Record<string, unknown>;
  const account: PinterestUserAccount = {
    id: typeof data.id === 'string' ? data.id : undefined,
    username: typeof data.username === 'string' ? data.username : undefined,
    profile_image:
      typeof data.profile_image === 'string'
        ? data.profile_image
        : typeof data.profile_image_url === 'string'
          ? data.profile_image_url
          : undefined,
    account_type: typeof data.account_type === 'string' ? data.account_type : undefined,
    business_name: typeof data.business_name === 'string' ? data.business_name : null,
    website_url: typeof data.website_url === 'string' ? data.website_url : null,
  };
  return { ok: true, account };
}
