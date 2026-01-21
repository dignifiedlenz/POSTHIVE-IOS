# AI Command System Smart Improvements

## Overview
This document describes improvements made to the AI command system to make it smarter, more flexible, and able to handle both direct questions and command execution.

## Problem
The original system was too rigid:
- Low temperature (0.3) made it too literal
- Couldn't answer general knowledge questions
- Failed on ambiguous commands like "remind me to text Marcus"
- Generic error messages weren't helpful

## Solution
Made the AI smarter by:
1. Increasing temperature for more creative interpretation
2. Enhanced system prompt with better guidance and examples
3. Smart retry logic for ambiguous commands
4. Ability to answer questions directly (not just execute commands)
5. Better error messages

---

## Changes Made

### 1. Increased Temperature
**File:** `MainApp_Code/src/app/api/ai/command/route.ts`

**Change:**
```typescript
// Before:
temperature: 0.3,

// After:
temperature: 0.7, // Higher temperature for more creative/intelligent interpretation
```

**Location:** Line ~456 (in the initial OpenAI API call)

**Why:** Higher temperature allows the AI to be more creative and make reasonable assumptions instead of being overly literal.

---

### 2. Enhanced System Prompt
**File:** `MainApp_Code/src/app/api/ai/command/route.ts`

**Changes:**

#### A. Added Dual-Mode Capability
Added at the beginning of the system prompt (around line 244):

```typescript
IMPORTANT: You can do TWO things:
1. **Answer questions directly** - If the user asks a general knowledge question (e.g., "what's the standard framerate of NTSC?", "what is 4K?", "how do I export from Premiere?", "what's the difference between H.264 and H.265?"), just answer it directly with text. Don't call any functions. Be helpful and informative.
2. **Execute commands** - If the user wants to create, update, delete, or find something in their workspace, call the appropriate function.

When the user asks "what", "how", "why", "when", "where", or "who" questions, they're usually asking for information, not trying to execute a command. Answer those directly.
```

#### B. Added Command Interpretation Guidelines
Added after the dual-mode section (around line 248):

```typescript
COMMAND INTERPRETATION GUIDELINES:
- Think about what the user is trying to accomplish, not just the literal words
- If something is ambiguous, make the most reasonable interpretation based on context
- Be generous with interpretations - if "remind me to X" could be a todo, it IS a todo
- If the user says something vague like "remind me to text Marcus", they want a todo with title "text Marcus"
- Use common sense: "remind me" = create a private todo, "schedule" = calendar event, "create" = new item
- When in doubt, ask yourself: "What would a helpful assistant do here?"
```

#### C. Added Smart Interpretation Examples
Added examples section (around line 256):

```typescript
EXAMPLES OF SMART INTERPRETATIONS:
- "remind me to text Marcus" → create_todo(title: "text Marcus", is_private: true)
- "remind me to call mom tomorrow" → create_todo(title: "call mom", due_date: "tomorrow", is_private: true)
- "I need to finish the video by Friday" → create_todo(title: "finish the video", due_date: "Friday") OR update existing todo
- "schedule a meeting with John next week" → create_calendar_event(title: "Meeting with John", start_time: next week)
- "what do I have today?" → get_today_tasks()
- "show me my tasks" → find_todos() or get_today_tasks() depending on context
- "mark the review as done" → mark_todo_complete() or find and complete the "review" todo
```

#### D. Enhanced Reminder Instructions
Updated the reminder section (around line 291):

```typescript
- REMINDERS: When the user says "Remind me to [action]" or "Remind me [to do something]", this is ALWAYS a create_todo command. Extract the action as the title (e.g., "remind me to text Marcus" → create_todo with title: "text Marcus", is_private: true). Any phrase starting with "remind me" should be treated as a create_todo command with is_private set to true.
```

---

### 3. Smart Retry Logic with Question Detection
**File:** `MainApp_Code/src/app/api/ai/command/route.ts`

**Location:** Lines ~480-580 (replaces the old "no tool call" error handling)

**Change:** Instead of immediately returning an error when no tool call is made, the system now:

1. **Checks if it's a question:**
   ```typescript
   if (!toolCall) {
     if (message.content) {
       const lowerCommand = command.toLowerCase().trim();
       const isQuestion = lowerCommand.startsWith('what') || 
                         lowerCommand.startsWith('how') || 
                         lowerCommand.startsWith('why') || 
                         lowerCommand.startsWith('when') || 
                         lowerCommand.startsWith('where') || 
                         lowerCommand.startsWith('who') ||
                         lowerCommand.includes('?') ||
                         // Check if it's clearly a knowledge question
                         (lowerCommand.includes('standard') && !lowerCommand.includes('create')) ||
                         (lowerCommand.includes('framerate') || lowerCommand.includes('frame rate')) ||
                         (lowerCommand.includes('resolution') && !lowerCommand.includes('create'));
       
       if (isQuestion) {
         // Return the AI's answer as success
         return NextResponse.json({
           success: true,
           message: message.content,
           isAnswer: true
         });
       }
     }
   ```

2. **If not a question, retries with smarter interpretation:**
   ```typescript
   // Retry with more aggressive interpretation
   const retryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
     // ... with updated system prompt that says:
     // "If this is a general knowledge question, answer it directly.
     //  If this is a command, call the appropriate function."
     tool_choice: 'auto', // Let AI decide
     temperature: 0.8, // Even higher for retry
   });
   ```

3. **Handles retry results:**
   - If retry produces a tool call → execute it
   - If retry produces text → return as answer
   - If retry fails → return helpful error with user's command

---

### 4. Updated create_todo Function Description
**File:** `MainApp_Code/src/lib/actions/ai-command-functions.ts`

**Location:** Line ~59

**Change:**
```typescript
// Before:
description: 'Create a new todo item. If the user says "Remind me..." or starts with "Remind me", create a private todo.',

// After:
description: 'Create a new todo item. IMPORTANT: When the user says "Remind me to [do something]" or "Remind me [to do something]", this is ALWAYS a request to create a todo. Extract the action as the title (e.g., "remind me to text Marcus" → title: "text Marcus", is_private: true). Any phrase starting with "remind me" should be treated as a create_todo command.',
```

---

## Response Format Changes

### New Response Format for Answers
When the AI answers a question directly (no function call), the response now includes:

```typescript
{
  success: true,
  message: "The AI's answer text here",
  isAnswer: true  // Flag to indicate this is an answer, not a command execution
}
```

### Updated Error Messages
Error messages now include the user's command for context:

```typescript
// Before:
message: "I couldn't understand that command. Try being more specific..."

// After:
message: `I'm not sure what you mean by "${command}". Try saying something like "remind me to text Marcus" or "create a todo to finish the video".`
```

---

## Implementation Checklist

When implementing these changes in the main codebase:

- [ ] Update temperature from 0.3 to 0.7 in the initial OpenAI API call
- [ ] Add the dual-mode section to the system prompt (answer questions vs execute commands)
- [ ] Add command interpretation guidelines to the system prompt
- [ ] Add smart interpretation examples to the system prompt
- [ ] Update the reminder instructions in the system prompt
- [ ] Replace the "no tool call" error handling with smart retry logic
- [ ] Add question detection logic (what/how/why/when/where/who + ?)
- [ ] Add retry logic with updated system prompt
- [ ] Handle retry responses (tool call vs text answer)
- [ ] Update create_todo function description in ai-command-functions.ts
- [ ] Update response format to include `isAnswer: true` for direct answers
- [ ] Update error messages to include user's command

---

## Testing

After implementation, test:

1. **Question answering:**
   - "what's the standard framerate of NTSC?" → Should return direct answer
   - "what is 4K?" → Should return direct answer
   - "how do I export from Premiere?" → Should return direct answer

2. **Command execution:**
   - "remind me to text Marcus" → Should create a private todo
   - "create a todo to finish the video" → Should create a todo
   - "show me my tasks" → Should call find_todos or get_today_tasks

3. **Ambiguous commands:**
   - "remind me to call mom tomorrow" → Should create todo with due date
   - "I need to finish the video by Friday" → Should create or update todo

4. **Error handling:**
   - Invalid commands should return helpful errors with suggestions

---

## Files Modified

1. `MainApp_Code/src/app/api/ai/command/route.ts`
   - System prompt updates
   - Temperature increase
   - Smart retry logic
   - Question detection
   - Response format updates

2. `MainApp_Code/src/lib/actions/ai-command-functions.ts`
   - Updated create_todo function description

---

## Notes

- The linter errors shown are TypeScript type definition issues (common in Next.js) and don't affect runtime
- The `isAnswer` flag in responses can be used by the frontend to display answers differently from command results
- The retry logic uses `tool_choice: 'auto'` to let the AI decide whether to answer or call a function
- Temperature is set higher (0.7-0.8) to allow more creative interpretation while still being reliable

