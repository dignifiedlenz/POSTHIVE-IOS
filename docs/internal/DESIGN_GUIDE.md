# Revue Design Guide
## Based on Drive Component Design Language

This guide establishes the design system used throughout the Revue application, derived from the Drive component's black & white, sharp-edged aesthetic.

---

## 🎨 Color Palette

### Primary Colors
- **Background**: `bg-black` - Pure black (#000000)
- **Surface**: `bg-black/40` - Semi-transparent black for cards/containers
- **Elevated Surface**: `bg-zinc-950` - Dark gray for layered elements

### Text Colors
- **Primary Text**: `text-white` - Pure white (#FFFFFF)
- **Secondary Text**: `text-zinc-400` - Medium gray for subtitles/descriptions
- **Tertiary Text**: `text-zinc-500` - Lighter gray for labels/metadata
- **Muted Text**: `text-zinc-600` - Very light gray for disabled/secondary info
- **Interactive Text**: `text-white/60` - Semi-transparent white for hover states

### Border Colors
- **Default Border**: `border-white/12` - Subtle white border (12% opacity)
- **Hover Border**: `border-white/15` - Slightly more visible on hover
- **Active Border**: `border-white/30` - More prominent for active states
- **Selected Border**: `border-white/70` - High contrast for selected items
- **Divider**: `divide-white/5` - Very subtle dividers between items

### Accent Colors (Use Sparingly)
- **Primary Action**: `bg-white text-black` - White background, black text
- **Secondary Action**: `bg-white/10 border border-white/30` - Semi-transparent with border
- **Destructive**: `border-red-600/50 bg-red-900/20 text-red-400` - Red accents for delete/danger
- **Warning**: `border-yellow-600/50 bg-yellow-900/20 text-yellow-400` - Yellow for warnings
- **Success**: `border-green-600/50 bg-green-900/20 text-green-400` - Green for success states

---

## 📝 Typography

### Font Families
- **Headers (h1-h6)**: `Montserrat` - All headers use Montserrat font family
- **Body Text**: System default (usually sans-serif)
- **Display Text**: `.font-display` utility class (Montserrat, 600 weight)

### Header Sizes
- **Page Title**: `text-4xl md:text-5xl` - Large, bold titles (DriveLayout)
- **Section Title**: `text-xl` - Medium section headers
- **Subtitle**: `text-base md:text-lg text-zinc-400` - Descriptive text below titles

### Text Styles
- **Uppercase Labels**: `text-xs uppercase tracking-[0.35em]` - Small, spaced uppercase text
- **Breadcrumbs**: `text-xs uppercase tracking-[0.4em] text-zinc-500` - Navigation breadcrumbs
- **Metadata**: `text-xs text-zinc-500` - Small secondary information
- **Body**: `text-sm` - Standard body text size

### Font Weights
- **Semibold**: `font-semibold` - For emphasis (600)
- **Medium**: `font-medium` - For secondary emphasis (500)
- **Regular**: Default (400)

---

## 📐 Spacing & Sizing

### Standard Heights
- **Controls/Buttons**: `h-11` (44px) - Standard height for all interactive elements
- **Input Fields**: `h-11` - Match button height
- **Icon Buttons**: `h-11 w-11` - Square icon-only buttons
- **Glyphs/Icons**: `h-12 w-12` - File/folder glyphs (48px)

### Border Radius
- **Sharp Edges**: `rounded-[0px]` or no rounded class - NO rounded corners
- **Container Borders**: Use `border` class without rounding
- **Exception**: Only DriveLayout uses `rounded-[28px]` for the main container

### Padding
- **Button Padding**: `px-4 py-2` - Standard button padding
- **Card Padding**: `p-4` or `p-6` - Container padding
- **Input Padding**: `px-3 py-2` or `pl-10` (with icon) - Input field padding
- **List Item Padding**: `px-5 py-4` - List row padding

### Gaps
- **Button Groups**: `gap-2` or `gap-3` - Spacing between buttons
- **Grid Gaps**: `gap-4` - Spacing in grid layouts
- **Section Gaps**: `gap-6` or `space-y-6` - Vertical spacing between sections

---

## 🔲 Border Styles

### Border Width
- **Standard**: `border` (1px) - Default border width
- **Thick**: `border-2` - For emphasis (rarely used)

### Border Patterns
```css
/* Standard container */
border border-white/12 bg-black/40

/* Hover state */
border-white/15 hover:border-white

/* Active/Selected */
border-white/70 bg-white/[0.05]

/* Dashed (empty states) */
border-dashed border-white/15
```

### Border Radius
- **NO rounded corners** - Sharp edges are key to the design
- **Exception**: Main DriveLayout container uses `rounded-[28px]`

---

## 🔘 Button Variants

### Primary Button
```tsx
className="bg-white text-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition-all hover:bg-zinc-200"
```
- White background, black text
- Used for main actions (Transfer, Download)

### Secondary Button
```tsx
className="border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white transition-colors hover:border-white"
```
- Transparent with border
- Used for standard actions (New Folder, Upload)

### Tertiary Button
```tsx
className="bg-white/10 border border-white/30 text-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition-all hover:bg-white/20 hover:border-white/50"
```
- Semi-transparent with border
- Used for secondary actions (Dropzone)

### Icon Button
```tsx
className="inline-flex h-11 w-11 items-center justify-center border border-white/15 text-white transition-colors hover:border-white"
```
- Square, icon-only
- Used for refresh, view toggles

### Destructive Button
```tsx
className="border border-red-600/50 bg-red-900/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-red-400 transition-all hover:bg-red-900/30 hover:border-red-600"
```
- Red accent colors
- Used for delete/destructive actions

### Button States
- **Default**: Standard styling
- **Hover**: `hover:border-white` or `hover:bg-zinc-200` (for primary)
- **Disabled**: `opacity-50 cursor-not-allowed`
- **Loading**: Show spinner icon with `animate-spin`

---

## 📦 Component Patterns

### Card/Container
```tsx
className="border border-white/12 bg-black/40 p-4"
```
- Standard container styling
- Sharp corners (no rounded)
- Subtle border and semi-transparent background

### Grid Item
```tsx
className="border border-white/12 bg-black/40 p-4 transition-all hover:bg-white/[0.03]"
```
- Card-like items in grid layouts
- Hover state adds slight background

### List Item
```tsx
className="grid grid-cols-[auto,1fr,120px,150px] items-center gap-4 px-5 py-4 text-sm transition-colors hover:bg-white/[0.03]"
```
- Multi-column layout
- Hover state for interactivity

### Empty State
```tsx
className="flex flex-col items-center justify-center border border-dashed border-white/15 p-12 text-center text-sm text-zinc-500"
```
- Dashed border
- Centered content
- Muted text color

### Status Badge
```tsx
className="border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.35em] text-white/70"
```
- Small, uppercase label
- Subtle border

---

## 🎯 Layout Patterns

### Page Container
```tsx
<div className="min-h-screen bg-black text-white p-4">
  <div className="max-w-7xl mx-auto">
    {/* Content */}
  </div>
</div>
```
- Full-height black background
- Centered max-width container
- Padding around edges

### Header Section
```tsx
<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
  <div className="flex flex-1 flex-wrap items-center gap-3">
    {/* Left side controls */}
  </div>
  <div className="flex items-center gap-3">
    {/* Right side controls */}
  </div>
</div>
```
- Responsive flex layout
- Left: Primary actions
- Right: View/sort controls

### Breadcrumbs
```tsx
<nav className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.4em] text-zinc-500">
  <Link href="/path" className="transition-colors hover:text-white">Label</Link>
  <span className="text-zinc-700">/</span>
  <span>Current</span>
</nav>
```
- Uppercase, spaced text
- Separated by `/`
- Links have hover state

---

## 🎨 Visual Effects

### Gradients
```tsx
// Subtle background gradient
className="bg-gradient-to-br from-white/5 to-white/0"

// Folder glyph gradient
className="bg-gradient-to-br from-zinc-900 to-black"
```

### Shadows
- **Rarely used** - Design is flat with borders
- **Exception**: DriveLayout uses `shadow-[0_60px_140px_rgba(0,0,0,0.55)]`

### Transitions
```tsx
// Standard transition
className="transition-colors hover:border-white"

// All properties
className="transition-all hover:bg-zinc-200"
```

---

## 🔍 Input Fields

### Text Input
```tsx
className="h-11 border border-white/10 bg-black/40 text-white placeholder:text-zinc-500 focus-visible:ring-white/30"
```
- Height matches buttons (`h-11`)
- Dark background with subtle border
- White text, gray placeholder

### Search Input (with icon)
```tsx
<div className="relative">
  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
  <Input className="h-11 pl-10 border-white/10 bg-black/40..." />
</div>
```
- Icon positioned absolutely
- Padding-left for icon space

---

## 📊 Grid & List Views

### Grid View
```tsx
<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
  {/* Grid items */}
</div>
```
- Responsive columns
- Consistent gap spacing

### List View
```tsx
<div className="divide-y divide-white/5 border border-white/10">
  {/* List items */}
</div>
```
- Vertical dividers between items
- Border around entire list

---

## 🎭 Interaction Patterns

### Selection
- **Files**: Single click = select (cumulative)
- **Folders**: Single click = open, checkbox for selection
- **Double click**: Preview/open file

### Selection Indicator
```tsx
className={cn(
  'border border-white/12 bg-black/40',
  isSelected && 'border-white/70 bg-white/[0.05]'
)}
```
- Selected items have brighter border and slight background

### Hover States
- **Buttons**: `hover:border-white` or `hover:bg-zinc-200`
- **Cards**: `hover:bg-white/[0.03]` - Very subtle
- **Links**: `hover:text-white` - Text color change

---

## 🚫 Anti-Patterns (What NOT to Do)

1. **NO rounded corners** - Except DriveLayout main container
2. **NO colorful backgrounds** - Stick to black/white/gray
3. **NO heavy shadows** - Keep it flat
4. **NO decorative icons** - Use functional icons only
5. **NO mixed font families** - Headers use Montserrat, body uses system default
6. **NO bright colors** - Except for status indicators (red/yellow/green)
7. **NO excessive spacing** - Keep it tight and efficient
8. **NO gradients on text** - Solid colors only

---

## 📋 Quick Reference

### Standard Button Height
```tsx
h-11  // 44px - Use for all buttons and inputs
```

### Standard Border
```tsx
border border-white/12  // Default
border-white/15        // Hover
border-white/70        // Selected/Active
```

### Standard Text Style
```tsx
text-xs uppercase tracking-[0.35em]  // Labels
text-sm                               // Body
text-4xl                              // Titles
```

### Standard Spacing
```tsx
gap-3   // Between buttons
gap-4   // Grid gaps
gap-6   // Section spacing
p-4     // Card padding
px-4 py-2  // Button padding
```

---

## 🎯 Component Checklist

When building a new component, ensure:

- [ ] Uses `h-11` for all interactive elements
- [ ] No rounded corners (sharp edges)
- [ ] Borders use `border-white/12` or variants
- [ ] Text uses Montserrat for headers
- [ ] Uppercase labels use `tracking-[0.35em]`
- [ ] Colors are black/white/gray (no bright colors)
- [ ] Hover states are subtle (`hover:border-white`)
- [ ] Consistent padding (`px-4 py-2` for buttons)
- [ ] Transitions are smooth (`transition-colors` or `transition-all`)
- [ ] Backgrounds are semi-transparent (`bg-black/40`)

---

## 📚 Example Components

### Standard Button
```tsx
<button className="inline-flex h-11 items-center gap-2 border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white transition-colors hover:border-white">
  <Icon className="h-4 w-4" />
  Button Text
</button>
```

### Primary Button
```tsx
<button className="inline-flex h-11 items-center gap-2 bg-white text-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition-all hover:bg-zinc-200">
  <Icon className="h-4 w-4" />
  Primary Action
</button>
```

### Card Container
```tsx
<div className="border border-white/12 bg-black/40 p-4">
  {/* Content */}
</div>
```

### List Item
```tsx
<div className="grid grid-cols-[auto,1fr,120px] items-center gap-4 px-5 py-4 text-sm border-b border-white/5 hover:bg-white/[0.03]">
  {/* Content */}
</div>
```

---

*Last updated: Based on Drive component implementation*


