# Signup offers — local admin verification

Date: 23 September 2026. Scope: the isolated admin worktree, with a local mock backend and fictional accounts. No production API, real account, payment provider, subscription mutation, or deployment was used.

## Checks completed

- `npm run typecheck` passed.
- `npm run build` passed and generated `/signup-offers` and the existing profile routes.
- `git diff --check` passed.
- Browser checks used the production admin build with `BACKEND_API_URL` pointing to a local mock API. The local server processes and browser tab were closed after testing.
- The later wording adjustment for historical desktop grants was checked with typecheck; it does not change access logic.

## Reproduction setup

Run the admin locally against an isolated fixture API using the contract below. Use a local-only admin login/token; do not supply production credentials. The dashboard layout also requests `/api/admin/billing-tasks`, which may return empty `pending` and `deadLetter` arrays and `owed: 0`.

`GET /api/admin/signup-lifetime` and successful `PATCH` responses:

```json
{
  "settings": {
    "iosSignupLifetimeEnabled": false,
    "desktopSignupLifetimeEnabled": false,
    "updatedAt": null,
    "updatedBy": null
  }
}
```

Have the fixture persist partial PATCH bodies in memory, return the complete saved settings, and record requests. It must also support delayed responses, GET failures, and a PATCH that saves successfully but returns an error. The browser should use the same localhost hostname throughout so its local session cookie is preserved.

## Settings checks and observed outcomes

| Action | Verified outcome |
| --- | --- |
| Open **Signup offers** with default fixture | Both switches show OFF; platform scope, new-signup eligibility, verification, reservation permanence and existing billing are explained. |
| Turn iOS ON | Saved state becomes ON/OFF. Request contains only `iosSignupLifetimeEnabled: true`. |
| Turn desktop ON | Saved state becomes ON/ON. Request contains only `desktopSignupLifetimeEnabled: true`. |
| Reload the page | Both saved values and last-modified information remain visible. |
| Delay a save response | Both switches and Reload are disabled; previous confirmed values remain displayed with a saving message. |
| Save iOS OFF, then simulate a lost/error response | An explicit error replaces the switches; the old ON state is not presented as current. No success message appears. |
| Reload settings after that error | Actual persisted OFF/ON state is recovered. |
| Make GET fail | State is unavailable, not silently OFF; Reload remains available. |

The three recorded mutation bodies were exactly `{ "iosSignupLifetimeEnabled": true }`, `{ "desktopSignupLifetimeEnabled": true }`, and `{ "iosSignupLifetimeEnabled": false }`. No mutation included the other platform field.

## Profile checks and observed outcomes

Serve complete existing `/api/admin/users/:id` fixtures with these additional user fields, then open their profile pages:

| Fixture | Verified outcome |
| --- | --- |
| Both lifetime timestamps present; a fictional active subscription in the existing subscriptions array | Separate iOS and desktop lifetime badges/date/scope appear. Subscription row, renewal date and management button remain visible. |
| `signupLifetimeOffer: "ios"`, email unverified, no lifetime timestamp | Shows **Reserved** and **awaiting email verification**, not an active lifetime grant. |
| Desktop lifetime timestamp plus `accessRevoked: true` | Retains grant history but labels access revoked and explains that account revocation blocks access. |

Additional wording regression checked by source review: an existing desktop lifetime timestamp with an unverified legacy account no longer receives a statement that verification is required before its already-granted access. The verification reminder applies only when a displayed offer has no grant timestamp.

These checks validate the admin presentation and request contract with fixtures. They do not establish compatibility with a deployed backend, real signup flow, or payment-provider behavior; those require the corresponding backend and application checks.
