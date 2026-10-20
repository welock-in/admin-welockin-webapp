type LifetimeAccount = {
  plan: string;
  emailVerified?: boolean | null;
  accessRevoked?: boolean | null;
  iosLifetimeGrantedAt?: string | null;
  desktopLifetimeGrantedAt?: string | null;
};

/** Platform grants never enter the global plan cache; display their actual scope. */
export function lifetimeLabel(user: LifetimeAccount): string | null {
  if (user.accessRevoked) return null;
  const ios = user.emailVerified === true && !!user.iosLifetimeGrantedAt;
  const desktop = !!user.desktopLifetimeGrantedAt;
  if (ios && desktop) return "Lifetime · iOS + desktop";
  if (ios) return "Lifetime · iOS";
  if (desktop) return "Lifetime · desktop";
  return null;
}

export function accountPlanLabel(user: LifetimeAccount): string {
  return user.accessRevoked ? "Revoked" : lifetimeLabel(user) ?? user.plan;
}
