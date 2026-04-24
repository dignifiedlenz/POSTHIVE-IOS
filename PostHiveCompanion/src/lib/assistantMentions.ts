import type {WorkspaceMember} from './types';

export type MentionAssignmentPayload = {user_id: string; name: string};

/** @mention the user is currently typing (no whitespace after @). */
export function getActiveMention(
  text: string,
  cursor: number,
): {start: number; query: string} | null {
  const beforeCursor = text.slice(0, cursor);
  const at = beforeCursor.lastIndexOf('@');
  if (at === -1) return null;
  const afterAt = beforeCursor.slice(at + 1);
  if (afterAt.length === 0) return {start: at, query: ''};
  if (/\s/.test(afterAt)) return null;
  return {start: at, query: afterAt};
}

export function filterMembersForMentionQuery(
  members: WorkspaceMember[],
  query: string,
): WorkspaceMember[] {
  const q = query.trim().toLowerCase();
  if (!q) return members;
  return members.filter(m => {
    const name = (m.name || '').toLowerCase();
    const email = (m.email || '').toLowerCase();
    const local = email.split('@')[0] || '';
    return name.includes(q) || email.includes(q) || local.includes(q);
  });
}

/**
 * Resolve @FullName segments against workspace members (longest name first).
 * Names must match from @ immediately; used when sending to the AI with mentionAssignments.
 */
export function extractResolvedMentions(
  text: string,
  members: WorkspaceMember[],
): MentionAssignmentPayload[] {
  const sorted = [...members].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
  const seen = new Set<string>();
  const out: MentionAssignmentPayload[] = [];
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf('@', i);
    if (at === -1) break;
    const rest = text.slice(at + 1);
    let matched: WorkspaceMember | null = null;
    for (const m of sorted) {
      const n = m.name || '';
      if (!n.length) continue;
      if (rest.toLowerCase().startsWith(n.toLowerCase())) {
        const boundary = rest[n.length];
        if (boundary === undefined || /[\s,!.?;:]/.test(boundary)) {
          matched = m;
          break;
        }
      }
    }
    if (matched && !seen.has(matched.user_id)) {
      seen.add(matched.user_id);
      out.push({user_id: matched.user_id, name: matched.name});
    }
    i = at + 1;
  }
  return out;
}
