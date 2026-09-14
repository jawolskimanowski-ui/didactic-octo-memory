import { useQuery } from "@tanstack/react-query";
import { bootstrapAccountFn, getMe } from "@/lib/api";

export type SiteUser = {
  id: string;
  uuid: string | null;
  nameCustomized: boolean;
  kind: "registered" | "guest";
  displayName: string;
  handle: string | null;
  bio: string;
  avatarHue: number;
  projectCount: number;
  publishedCount: number;
  remainingDeploys: number | null;
  isGuest: boolean;
  email: null;
};

export function useCurrentSiteUserState() {
  const query = useQuery({
    queryKey: ["site-user"],
    queryFn: async () => {
      return getMe();
    },
  });
  return {
    user: (query.data as SiteUser | null | undefined) ?? null,
    isPending: query.isPending,
  };
}

export function useCurrentSiteUser() {
  return useCurrentSiteUserState().user;
}

export async function ensureSiteAccount() {
  return bootstrapAccountFn();
}
