# Football Manager Style Font Hierarchy Guide

## 🎯 Overview

This font system recreates the Football Manager UI aesthetic with proper visual hierarchy, color contrast, and responsive sizing. It uses **Bebas Neue** for headers and **Satoshi** for all body text.

---

## 🔤 Font Classes & Usage

### 🟣 Headers - Bebas Neue (All Caps)
*Use for main titles, page headers, modal titles*

```html
<!-- Main page titles -->
<h1 class="font-header text-header">HIRE AN INTERMEDIARY</h1>

<!-- Large hero sections -->
<h1 class="font-header-large text-header">PLAYER TRANSFERS</h1>

<!-- Smaller section headers -->
<h2 class="font-header-small text-header">RECENT ACTIVITY</h2>
```

**Sizes:**
- `font-header`: 28px desktop / 24px mobile
- `font-header-large`: 32px desktop / 28px mobile  
- `font-header-small`: 24px desktop / 20px mobile

---

### 🔵 Subheaders - Satoshi Bold
*Use for entity names, section titles, important labels*

```html
<!-- Player/Agent names -->
<h3 class="font-subheader text-subheader">Scott Gilligan</h3>

<!-- Table headers -->
<th class="font-subheader-small text-subheader">Agent Name</th>

<!-- Card titles -->
<h4 class="font-subheader-large text-subheader">Transfer Details</h4>
```

**Sizes:**
- `font-subheader`: 18px desktop / 16px mobile
- `font-subheader-large`: 20px desktop / 18px mobile
- `font-subheader-small`: 16px desktop / 14px mobile

---

### 🟡 Primary Body - Satoshi Regular/Medium
*Use for main content, descriptions, important information*

```html
<!-- Main content paragraphs -->
<p class="font-body-primary text-body-primary">
  To gain insight into the player's market value and receive guidance on potential offers...
</p>

<!-- Emphasized content -->
<p class="font-body-medium text-body-primary">Transfer Status: Active</p>

<!-- Large readable text -->
<div class="font-body-primary-large text-body-primary">Important Notice</div>

<!-- Compact content -->
<span class="font-body-medium-small text-body-primary-dimmed">14 days remaining</span>
```

**Sizes:**
- `font-body-primary`: 16px desktop / 14px mobile
- `font-body-primary-large`: 18px desktop / 16px mobile
- `font-body-medium`: 16px desktop / 14px mobile (weight: 500)
- `font-body-medium-small`: 14px desktop / 12px mobile (weight: 500)

---

### ⚪ Secondary Body - Satoshi Regular
*Use for supporting information, less important content*

```html
<!-- Supporting descriptions -->
<p class="font-body-secondary text-body-secondary">
  Additional transfer details and supplementary information
</p>

<!-- Small labels -->
<span class="font-body-secondary-small text-body-tertiary">Offer Type</span>

<!-- Table data -->
<td class="font-body-secondary text-body-secondary">£2.5M</td>
```

**Sizes:**
- `font-body-secondary`: 14px desktop / 12px mobile
- `font-body-secondary-small`: 12px desktop / 11px mobile

---

### 🔘 Meta Text - Satoshi Italic
*Use for timestamps, footnotes, disclaimers, hints*

```html
<!-- Timestamps -->
<time class="font-meta text-meta">This Afternoon</time>

<!-- Disclaimers -->
<p class="font-meta-medium text-meta-subtle">
  *Expected deal value may include additional clauses
</p>

<!-- Tooltips -->
<span class="font-meta text-meta">Last updated 2 hours ago</span>
```

**Sizes:**
- `font-meta`: 12px desktop / 11px mobile
- `font-meta-medium`: 14px desktop / 12px mobile

---

### 🟠 Highlights - Satoshi Bold
*Use for values, prices, important numbers, call-to-actions*

```html
<!-- Financial values -->
<span class="font-highlight text-highlight">£31M - £38.5M</span>

<!-- Large prices -->
<div class="font-highlight-large text-highlight-white">€50M</div>

<!-- Compact values -->
<span class="font-highlight-small text-highlight">10%</span>

<!-- Status indicators -->
<span class="font-highlight text-highlight-success">Completed</span>
<span class="font-highlight text-highlight-warning">Pending</span>
<span class="font-highlight text-highlight-danger">Rejected</span>
```

**Sizes:**
- `font-highlight`: 18px desktop / 16px mobile
- `font-highlight-large`: 20px desktop / 18px mobile
- `font-highlight-small`: 15px desktop / 14px mobile

---

## 🎨 Color Hierarchy

### Text Colors (Light to Dark)
```css
.text-header           /* #FFFFFF - Pure white for headers */
.text-subheader        /* #F5F5F5 - Off-white for entity names */
.text-body-primary     /* #E0E0E0 - Light grey for main content */
.text-body-primary-dimmed /* #D0D0D0 - Slightly dimmed primary */
.text-body-secondary   /* #A0A0A0 - Medium grey for less important */
.text-body-tertiary    /* #909090 - Darker grey for subtle content */
.text-meta             /* #888888 - Dark grey for timestamps */
.text-meta-subtle      /* #757575 - Even subtler for disclaimers */
```

### Highlight Colors
```css
.text-highlight        /* #FDCB58 - FM yellow for values */
.text-highlight-white  /* #FFFFFF - White highlights */
.text-highlight-success /* #4ADE80 - Green for positive */
.text-highlight-warning /* #FB923C - Orange for warnings */
.text-highlight-danger  /* #F87171 - Red for negative */
```

---

## 📱 Responsive Behavior

The system is **mobile-first** with breakpoint at `768px`:

- **Mobile (< 768px)**: Smaller, more compact sizes
- **Desktop (≥ 768px)**: Full-size typography

All classes automatically adjust based on screen size.

---

## 🚀 Usage Examples

### Modal Header
```html
<div class="modal-header">
  <h1 class="font-header text-header">TRANSFER NEGOTIATIONS</h1>
  <h2 class="font-subheader text-subheader">Lionel Messi</h2>
</div>
```

### Data Table
```html
<table>
  <thead>
    <tr>
      <th class="font-subheader-small text-subheader">Agent</th>
      <th class="font-subheader-small text-subheader">Commission</th>
      <th class="font-subheader-small text-subheader">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="font-body-medium text-body-primary">Jorge Mendes</td>
      <td class="font-highlight text-highlight">10%</td>
      <td class="font-body-secondary text-highlight-success">Active</td>
    </tr>
  </tbody>
</table>
```

### Card Component
```html
<div class="card">
  <h3 class="font-subheader text-subheader">Transfer Offer</h3>
  <p class="font-body-primary text-body-primary">
    Manchester United has submitted an official bid
  </p>
  <div class="values">
    <span class="font-highlight-large text-highlight">£85M</span>
    <time class="font-meta text-meta">2 hours ago</time>
  </div>
</div>
```

---

## ✅ Best Practices

1. **Use appropriate hierarchy** - Don't skip levels
2. **Combine font and color classes** - Always pair them
3. **Consider mobile users** - Text automatically scales down
4. **Use highlights sparingly** - For important values only
5. **Maintain contrast** - Ensure readability on dark backgrounds

---

## 🔧 Technical Notes

- **Font loading**: Bebas Neue loaded locally, Satoshi via CSS
- **Performance**: `font-display: swap` for fast loading
- **Accessibility**: Maintains contrast ratios for readability
- **Responsive**: Mobile-first approach with desktop overrides