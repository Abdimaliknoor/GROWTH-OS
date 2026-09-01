---
name: Growth OS
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#c7c6c6'
  on-secondary: '#303031'
  secondary-container: '#464747'
  on-secondary-container: '#b5b5b5'
  tertiary: '#ffffff'
  on-tertiary: '#2f3131'
  tertiary-container: '#e2e2e2'
  on-tertiary-container: '#636565'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.04em
  display-lg-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  code:
    fontFamily: Geist Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  xxl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  max-width: 1200px
---

## Brand & Style
The design system is built for "Growth OS," a platform dedicated to clarity, focus, and intentional progress. The brand personality is disciplined, quiet, and sophisticated, acting as a neutral vessel for the user's data and personal evolution.

The aesthetic follows a **Minimalist / High-Contrast** approach. By removing the distraction of color, the UI emphasizes information hierarchy and structural integrity. Drawing inspiration from high-end productivity tools, the design prioritizes high-quality typography, generous whitespace, and precise linework. The emotional goal is to evoke a sense of "digital calm" and professional reliability, ensuring the interface never competes with the user's focus.

## Colors
The palette is strictly monochrome, utilizing a range of grayscale values to establish depth and hierarchy without the use of hue or saturation.

- **Primary:** White (#FFFFFF) is reserved for high-priority text, icons, and primary action states.
- **Secondary:** Muted Gray (#888888) is used for secondary text, metadata, and disabled states.
- **Surface & Containers:** Deep Charcoal (#121212) and Slate (#1A1A1A) define the layers sitting above the pure black canvas.
- **Borders:** Subtle Grays (#262626) provide structure through 1px strokes.
- **Background:** Pure Black (#000000) is the base foundation, ideal for OLED displays and reducing visual fatigue.

## Typography
This design system utilizes **Geist** for its technical precision and modern humanist feel. The typographic hierarchy is aggressive to compensate for the lack of color. 

Large headings use tight letter-spacing and heavy weights to anchor sections, while body text maintains generous line height for readability. Small labels and metadata should use uppercase styles with slight tracking (letter-spacing) to differentiate them from interactive body text. All text should be rendered with `antialiased` smoothing for maximum clarity on dark backgrounds.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. Content is contained within a 1200px max-width container on desktop, centered with flexible margins. 

The spacing rhythm is based on a **4px baseline grid**. 
- **Desktop:** 12-column grid with 24px gutters.
- **Tablet:** 8-column grid with 20px gutters.
- **Mobile:** 4-column grid with 16px gutters and 16px side margins.

Vertical rhythm is crucial; use the `xl` (48px) and `xxl` (80px) units to separate major content sections, creating the "airy" feel characteristic of high-end SaaS products.

## Elevation & Depth
Depth is communicated through **Tonal Layering** and **Minimal Outlines** rather than heavy shadows.

- **Level 0 (Base):** #000000 (Pure Black).
- **Level 1 (Cards/Sidebar):** #0A0A0A with a 1px #262626 border.
- **Level 2 (Modals/Popovers):** #121212 with a 1px #333333 border and a subtle, high-diffusion shadow (0px 8px 24px rgba(0,0,0,0.5)).
- **Interactions:** On hover, elements should either lighten their background slightly or increase border brightness. Shadows should remain minimal to keep the interface feeling "flat" and lightweight.

## Shapes
The shape language is structured and architectural. 
- **Standard UI Elements:** Buttons and input fields use a `0.5rem` (8px) radius.
- **Containers:** Large cards and content blocks use `rounded-lg` (16px) to provide a softer, more approachable frame for data.
- **Status Indicators:** Small tags or badges use a "pill" shape (999px radius) to contrast against the predominantly rectangular grid.

## Components
- **Buttons:** Primary buttons are Solid White with Black text. Secondary buttons are outlined (1px White or Gray) with no fill.
- **Cards:** Background: #0A0A0A, Border: 1px #262626. Padding should be consistent (24px).
- **Input Fields:** Ghost style; a 1px #262626 bottom border or a full subtle outline that brightens to #FFFFFF on focus.
- **Chips/Tags:** Small, #1A1A1A background with #888888 text. No border.
- **Lists:** Rows separated by 1px #1A1A1A dividers. Hover state shifts background to #0D0D0D.
- **Icons:** Use 24px bounding boxes with 1.5pt stroke weights. All icons are grayscale.
- **Progress Bars:** Thin 4px tracks in #1A1A1A with a solid White indicator for the progress.