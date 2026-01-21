# Widget Deliverable Selection Fix

## 🐛 Problem

The widget was showing a different deliverable than the first one displayed on the dashboard. The widget used `pickMostUrgentDeliverable()` which prioritized deliverables with:
- Unread comments
- Status = 'review'
- Most recently updated

But the dashboard displays deliverables sorted by `updated_at` descending (most recent first), showing `sortedDeliverables[0]`.

## ✅ Solution

### 1. **Fixed Widget Sync Priority**
**File:** `src/hooks/useWidgetSync.ts`

**Change:**
- Now prioritizes `latestDeliverable` prop (which comes from dashboard) over `pickMostUrgentDeliverable()`
- Only falls back to `pickMostUrgentDeliverable()` if `latestDeliverable` is not provided

**Before:**
```typescript
const deliverable =
  pickMostUrgentDeliverable(deliverablesRef.current) ?? deliverableRef.current;
```

**After:**
```typescript
// Use latestDeliverable prop first (matches dashboard), fallback to pickMostUrgentDeliverable
const deliverable =
  deliverableRef.current ?? pickMostUrgentDeliverable(deliverablesRef.current);
```

### 2. **Fixed Dashboard to Pass Correct Deliverable**
**File:** `src/screens/dashboard/DashboardScreen.tsx`

**Changes:**
- Moved `sortedDeliverables` definition before `useWidgetSync` call
- Updated `useWidgetSync` to pass `sortedDeliverables[0]` instead of `deliverables[0]`

**Before:**
```typescript
// useWidgetSync called at line 272
useWidgetSync({
  latestDeliverable: deliverables[0] || null,  // Unsorted!
});

// sortedDeliverables defined at line 342 (too late!)
const sortedDeliverables = [...deliverables].sort(...);
```

**After:**
```typescript
// sortedDeliverables defined first
const sortedDeliverables = [...deliverables].sort((a, b) => {
  const dateA = new Date(a.updated_at || a.created_at).getTime();
  const dateB = new Date(b.updated_at || b.created_at).getTime();
  return dateB - dateA;
});

// useWidgetSync uses sortedDeliverables[0]
useWidgetSync({
  latestDeliverable: sortedDeliverables[0] || null,  // Matches dashboard!
});
```

## 🎯 Result

Now the widget will **always** show the same deliverable as the **first deliverable** displayed on the dashboard:

1. Dashboard displays `sortedDeliverables[0]` (most recently updated)
2. Dashboard passes `sortedDeliverables[0]` to `useWidgetSync` as `latestDeliverable`
3. Widget sync prioritizes `latestDeliverable` prop
4. Widget displays the same deliverable as dashboard! ✅

## 📝 Files Modified

1. **`src/hooks/useWidgetSync.ts`**
   - Changed priority order to use `latestDeliverable` prop first

2. **`src/screens/dashboard/DashboardScreen.tsx`**
   - Moved `sortedDeliverables` definition before `useWidgetSync`
   - Updated to pass `sortedDeliverables[0]` instead of `deliverables[0]`

## 🧪 Testing

To verify the fix:

1. **Open the app dashboard**
   - Note the first deliverable shown in the horizontal scroll

2. **Check the widget**
   - The widget should show the **exact same deliverable** as the first one on the dashboard

3. **Test edge cases:**
   - No deliverables → Widget shows empty state
   - Single deliverable → Widget shows it
   - Multiple deliverables → Widget shows the most recently updated one (same as dashboard)

## 🔄 Fallback Behavior

If `latestDeliverable` prop is not provided (e.g., from a different screen), the widget will still use `pickMostUrgentDeliverable()` as a fallback, which prioritizes:
- Deliverables with unread comments
- Deliverables in 'review' status
- Most recently updated

This ensures the widget always shows something useful even if called from contexts that don't provide `latestDeliverable`.

---

**Status:** ✅ Fixed - Widget now matches dashboard deliverable selection!
