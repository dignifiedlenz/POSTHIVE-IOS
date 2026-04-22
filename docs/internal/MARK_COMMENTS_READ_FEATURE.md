# Mark Comments as Read Feature

## ✅ Implementation Complete

### **Problem**
When users view the deliverable review page, comments should be automatically marked as read so the unread count badge updates correctly.

### **Solution**
Added an observer (useEffect) that automatically marks comments as read when:
1. The review screen loads a version
2. The user switches to a different version

---

## 📝 Changes Made

### 1. **Added API Function**
**File:** `src/lib/api.ts`

**New Function:**
```typescript
export async function markDeliverableCommentsAsRead(
  deliverableId: string,
  versionId?: string,
  markAsRead: boolean = true,
): Promise<void>
```

**What it does:**
- Calls the Next.js API endpoint: `/api/deliverables/[deliverableId]/unread-comments`
- Marks comments as read (or just seen) for the specified deliverable
- Optionally filters by versionId to only mark comments for a specific version
- Uses authenticated Supabase session token

---

### 2. **Added Observer in DeliverableReviewScreen**
**File:** `src/screens/deliverables/DeliverableReviewScreen.tsx`

**Added useEffect Hook:**
```typescript
useEffect(() => {
  if (!currentVersion || isLoading) return;
  
  const markCommentsAsRead = async () => {
    try {
      await markDeliverableCommentsAsRead(deliverableId, currentVersion.id, true);
      console.log('[DeliverableReview] Marked comments as read for version:', currentVersion.version_number);
    } catch (error) {
      console.error('[DeliverableReview] Error marking comments as read:', error);
    }
  };
  
  const timer = setTimeout(() => {
    markCommentsAsRead();
  }, 300);
  
  return () => clearTimeout(timer);
}, [deliverableId, currentVersion?.id, isLoading]);
```

**What it does:**
- Watches for changes to `currentVersion` and `isLoading`
- When a version is loaded (and not loading), marks all comments for that version as read
- Includes a 300ms delay to ensure version data is fully loaded
- Handles errors gracefully (doesn't block UI)

---

## 🎯 Behavior

### **When Comments Are Marked as Read:**

1. **Initial Load:**
   - User navigates to deliverable review screen
   - Version loads → Comments automatically marked as read
   - Unread badge count updates

2. **Version Switch:**
   - User switches to a different version
   - New version loads → Comments for that version marked as read
   - Unread badge updates accordingly

3. **Error Handling:**
   - If API call fails, error is logged but UI continues normally
   - User experience is not interrupted

---

## 🔄 API Endpoint Details

**Endpoint:** `POST /api/deliverables/[deliverableId]/unread-comments`

**Request Body:**
```json
{
  "markAsRead": true,  // true = mark as read, false = mark as seen only
  "versionId": "optional-version-id"  // If provided, only mark comments for this version
}
```

**Response:**
```json
{
  "success": true
}
```

**What happens in the database:**
- Updates `comment_read_states` table
- Sets `first_seen_at` timestamp (if not already set)
- Sets `read_at` timestamp (if `markAsRead: true`)
- Uses upsert with conflict resolution on `(user_id, comment_id)`

---

## 📱 User Experience

### **Before:**
- User views deliverable review page
- Unread badge still shows unread count
- User has to manually mark comments as read (if that feature existed)

### **After:**
- User views deliverable review page
- Comments automatically marked as read
- Unread badge updates immediately
- Seamless, automatic experience

---

## 🧪 Testing

### **Test Cases:**

1. **Initial Load:**
   - Navigate to deliverable with unread comments
   - Verify comments are marked as read
   - Check unread badge count decreases

2. **Version Switch:**
   - Switch to version with unread comments
   - Verify comments for that version are marked as read
   - Check unread badge updates

3. **Multiple Versions:**
   - Switch between versions multiple times
   - Verify each version's comments are marked as read
   - Check no duplicate API calls

4. **Error Handling:**
   - Simulate network error
   - Verify app doesn't crash
   - Verify error is logged

---

## 🔍 Technical Details

### **Dependencies:**
- `currentVersion?.id` - Triggers when version changes
- `isLoading` - Prevents marking while still loading
- `deliverableId` - Ensures correct deliverable

### **Timing:**
- 300ms delay ensures version data is fully loaded
- Prevents race conditions with data fetching

### **Error Handling:**
- Try/catch around API call
- Errors logged but don't throw
- UI continues normally even if marking fails

---

## 📊 Impact

### **Benefits:**
- ✅ Automatic comment read tracking
- ✅ Accurate unread badge counts
- ✅ Better user experience
- ✅ No manual action required

### **Performance:**
- Minimal overhead (single API call per version view)
- Non-blocking (doesn't affect UI rendering)
- Efficient (only marks when version changes)

---

## 🚀 Future Enhancements

Potential improvements:
- [ ] Mark comments as read when scrolling past them
- [ ] Mark comments as read when video plays past their timestamp
- [ ] Batch mark multiple deliverables at once
- [ ] Add visual feedback when marking as read

---

**Status:** ✅ Complete and ready for testing!
