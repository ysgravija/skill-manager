# Appearance

The user can switch between light and black themes while reading the same library.

## Sub-features

- `appearance-black` switches to the black theme.
- `appearance-light` restores the light theme.
- `appearance-persist` keeps the choice after a browser reload in the same tab.

## How to get to it (user POV)

- Choose **Light** or **Black** in the **Appearance** control in the top bar.

## Driving it with CUA browser

Preconditions: launch a fresh fixture, pass doctor, and open `READY_URL` in a new CUA tab.

- **Black:** click `tab.playwright.getByRole('button', { name: 'Black' })`; inspect the accessible pressed state and a screenshot of the dark surface.
- **Persist:** reload the tab and confirm **Black** is still pressed while **Verification Seed** remains readable.
- **Light:** click **Light** and confirm the light surface and pressed state.

## Gotchas

- The theme lives in browser `localStorage`, separate from server data. A new browser profile may start in light mode.
- Accessibility may expose these pressed buttons as checkboxes; use the current accessibility state if a role-based locator does not match.
