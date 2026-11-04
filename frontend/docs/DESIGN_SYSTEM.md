# Hirgal Design System

This document describes the reusable visual and interaction foundation in Frontend Phase 2. The system is implemented in `src/styles/globals.css`, shared components under `src/components/`, and the application shell under `src/components/layout/`.

## Principles

- Keep workspaces calm, readable, and focused; reserve the primary blue for key actions and active navigation.
- Use semantic tokens instead of repeated literal colors.
- Prefer clear hierarchy and whitespace to decoration.
- Use text, icon, and shape in addition to color to communicate state.
- Keep shared components composable and data-agnostic.
- Use accessible Radix primitives for complex keyboard and focus behavior.

## Color tokens

The light theme is a near-white neutral surface with charcoal text and a restrained blue primary. Semantic green, amber, red, and blue tokens communicate success, warning, error, and information. The sidebar has its own surface, text, muted-text, active-surface, and active-text tokens.

CSS custom properties are defined in `src/styles/globals.css` and mapped into Tailwind CSS 4 by `@theme inline`:

| Token | Purpose |
| --- | --- |
| `background`, `foreground` | Main application canvas and text |
| `card`, `card-foreground` | Raised content surfaces |
| `popover`, `popover-foreground` | Menus and floating surfaces |
| `primary`, `primary-foreground` | Main actions and selected emphasis |
| `secondary`, `secondary-foreground` | Secondary controls and subtle surfaces |
| `muted`, `muted-foreground` | Quiet backgrounds and explanatory text |
| `accent`, `accent-foreground` | Hover and selected surfaces |
| `destructive`, `destructive-foreground` | Errors and destructive actions |
| `success`, `warning`, `info` and `*-foreground` | Semantic status and alert treatments |
| `sidebar`, `sidebar-foreground`, `sidebar-muted` | Navigation surfaces and text |
| `sidebar-active`, `sidebar-active-foreground` | Selected navigation item |
| `border`, `input`, `ring` | Dividers, form borders, and focus indication |

Use classes such as `bg-background`, `text-muted-foreground`, `border-border`, `bg-success`, and `ring-ring`; do not introduce inline hex colors in feature components.

## Typography

The system uses a system-first sans-serif stack with Inter when available, and a platform monospace stack for code-like content. Named utility sizes establish the display, page-title, section-title, and card-title hierarchy. Body copy uses `text-sm`/`text-base` with comfortable leading; metadata and labels use compact sizes while maintaining contrast.

## Spacing, sizing, and elevation

Use Tailwind's standard spacing scale. Typical page gutters are `px-4 sm:px-6 lg:px-8`; sections use consistent `gap-4` to `gap-8`; controls use 40px minimum heights and 36px compact controls. Containers use `max-w-7xl` or `max-w-[90rem]`. The base radius is 10px with smaller and larger semantic steps. Elevation is intentionally limited to `shadow-card` and `shadow-popover`; borders define most surface separation.

## Theme strategy

`ThemeProvider` supports `light`, `dark`, and `system`. The preference is stored under `hirgal-theme`; system mode follows `prefers-color-scheme`. A small pre-render script applies the saved/system class before the application mounts to minimize flashing. The token values change under `:root.dark`, and `color-scheme` updates native form controls. Theme preference is presentation state only and does not use or affect authentication storage.

## Components

### Actions and forms

- `Button`: primary/default, secondary, outline, ghost, destructive, and link variants; small, default, large, and icon sizes; loading and disabled states.
- `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, and `Label`.
- `FormField`: label, required indicator, helper text, and validation message wrapper.

Keep controls controlled by the consuming form when state or validation is needed. Associate labels and descriptions using IDs; set `aria-invalid` and announce validation errors.

### Layout and feedback

- `Card` with header, title, description, content, and footer.
- `Container`, `PageHeader`, `SectionHeader`, `ResponsiveGrid`, `Stack`, and `Inline`.
- `Separator`; `Alert` with default, info, success, warning, and destructive variants; `Badge` and `StatusBadge`.
- `Dialog`, `AlertDialog`, `DropdownMenu`, `Popover`, `Tooltip`, `Tabs`, and Sonner toasts.
- `Skeleton`, `Spinner`, `LoadingState`, `EmptyState`, and `ErrorState`.

Use confirmation dialogs for consequential actions; provide meaningful title/description and explicit cancel/action labels. Toasts are for brief feedback, not important information that must persist.

### Data display

- `Avatar`, `AvatarGroup`, and `UserIdentity`.
- `Table` semantic wrappers with horizontal overflow on narrow screens.
- `Pagination`, `Progress`, and `Metadata`.

Data components receive content and state from their caller; they do not fetch or fabricate backend data.

### Navigation and application shell

`AppShell` composes a configuration-driven `Sidebar`, sticky top header, theme switcher, breadcrumb, and main content. The sidebar is fixed on medium and larger layouts; on smaller screens it is opened in an accessible modal drawer with a restrained entrance/exit transition and close-on-navigation behavior. Planned destinations are visibly labeled and disabled where APIs are not ready. Existing placeholder routes remain explicitly deferred.

## Responsive behavior

Use mobile-first utilities. Page headers and action groups stack on narrow viewports. Content grids expand from one column to two and three columns at larger breakpoints. Tables scroll within their container. Navigation collapses into the drawer below the medium breakpoint. Controls maintain touch-friendly hit areas.

## Accessibility

- Use semantic HTML, labels, table headers, and navigation landmarks.
- Use Radix primitives for focus management, keyboard interactions, and dialog/menu semantics.
- Keep a visible `:focus-visible` ring and sufficient contrast in both themes.
- Pair status colors with readable text and, where useful, a shape or icon.
- Respect `prefers-reduced-motion`; transitions are brief and non-essential.
- Give icon-only buttons accessible names and decorative icons `aria-hidden`.

## Showcase

Run `npm run dev`, then visit [`/dev/design-system`](http://localhost:5173/dev/design-system). The route is registered only when Vite is in development mode and is absent from production route configuration. Its names, statuses, and tabular values are illustrative static examples; it sends no backend requests.
