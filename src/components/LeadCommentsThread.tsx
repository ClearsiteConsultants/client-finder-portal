'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type LeadComment = {
  id: string;
  businessId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  authorUser: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

type LeadCommentsResponse = {
  comments: LeadComment[];
};

type LeadCommentsThreadProps = {
  leadId: string | undefined;
  currentUserId: string | null;
};

function formatCommentDate(date: string) {
  const parsed = new Date(date);
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDisplayName(comment: LeadComment) {
  return comment.authorUser.name || comment.authorUser.email || 'Unknown User';
}

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'U';
  }

  return parts.map((part) => part[0].toUpperCase()).join('');
}

export default function LeadCommentsThread({ leadId, currentUserId }: LeadCommentsThreadProps) {
  const [comments, setComments] = useState<LeadComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [postingReply, setPostingReply] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadComments = useCallback(async () => {
    if (!leadId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/comments`);
      if (!response.ok) {
        throw new Error('Failed to load comments');
      }

      const data: LeadCommentsResponse = await response.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch {
      setError('Failed to load comments. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const commentsByParent = useMemo(() => {
    const map = new Map<string | null, LeadComment[]>();

    for (const comment of comments) {
      const key = comment.parentCommentId;
      const bucket = map.get(key) || [];
      bucket.push(comment);
      map.set(key, bucket);
    }

    for (const [, bucket] of map) {
      bucket.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }

    return map;
  }, [comments]);

  const submitComment = async () => {
    const content = newComment.trim();
    if (!content || !leadId) return;

    setPostingComment(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      const created: LeadComment = await response.json();
      setComments((prev) => [...prev, created]);
      setNewComment('');
    } catch {
      setError('Failed to post comment. Please try again.');
    } finally {
      setPostingComment(false);
    }
  };

  const submitReply = async (parentCommentId: string) => {
    const content = replyDraft.trim();
    if (!content || !leadId) return;

    setPostingReply(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentCommentId }),
      });

      if (!response.ok) {
        throw new Error('Failed to post reply');
      }

      const created: LeadComment = await response.json();
      setComments((prev) => [...prev, created]);
      setReplyingToId(null);
      setReplyDraft('');
    } catch {
      setError('Failed to post reply. Please try again.');
    } finally {
      setPostingReply(false);
    }
  };

  const startEditing = (comment: LeadComment) => {
    setEditingId(comment.id);
    setEditDraft(comment.content);
    setReplyingToId(null);
  };

  const saveEdit = async (commentId: string) => {
    const content = editDraft.trim();
    if (!content || !leadId) return;

    setSavingEdit(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to edit comment');
      }

      const updated: LeadComment = await response.json();
      setComments((prev) => prev.map((comment) => (comment.id === updated.id ? updated : comment)));
      setEditingId(null);
      setEditDraft('');
    } catch {
      setError('Failed to edit comment. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const renderComment = (comment: LeadComment, depth = 0) => {
    const replies = commentsByParent.get(comment.id) || [];
    const displayName = getDisplayName(comment);
    const isEdited = Boolean(comment.editedAt);
    const isAuthor = currentUserId === comment.authorUser.id;

    return (
      <div key={comment.id} className={depth > 0 ? 'mt-3 ml-4 border-l border-slate-200 pl-4 dark:border-slate-700' : 'mt-4'}>
        <div className="rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950">
          <div className="flex items-center justify-between rounded-t-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                {getInitials(displayName)}
              </div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{displayName}</span>
              <span className="theme-text-muted">commented on {formatCommentDate(comment.createdAt)}</span>
              {isEdited && <span className="theme-text-muted">(edited)</span>}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setReplyingToId(comment.id);
                  setReplyDraft('');
                  setEditingId(null);
                }}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Reply
              </button>
              {isAuthor && (
                <button
                  type="button"
                  onClick={() => startEditing(comment)}
                  className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          <div className="px-3 py-3">
            {editingId === comment.id ? (
              <div className="space-y-2">
                <textarea
                  value={editDraft}
                  onChange={(event) => setEditDraft(event.target.value)}
                  rows={4}
                  className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(comment.id)}
                    disabled={savingEdit || !editDraft.trim()}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingEdit ? 'Saving...' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditDraft('');
                    }}
                    disabled={savingEdit}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{comment.content}</p>
            )}
          </div>
        </div>

        {replyingToId === comment.id && (
          <div className="mt-2 ml-4 rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
            <textarea
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              rows={3}
              placeholder="Write a reply..."
              className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => submitReply(comment.id)}
                disabled={postingReply || !replyDraft.trim()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {postingReply ? 'Replying...' : 'Reply'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplyingToId(null);
                  setReplyDraft('');
                }}
                disabled={postingReply}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {replies.length > 0 && (
          <div className="mt-2">
            {replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-lg font-semibold">Notes</h2>
      <p className="theme-text-muted mt-1 text-sm">Discussion for this lead, including replies and edits.</p>

      <div className="mt-4 rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
        <textarea
          value={newComment}
          onChange={(event) => setNewComment(event.target.value)}
          rows={4}
          placeholder="Leave a comment"
          className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="theme-text-muted text-xs">Supports multiple comments and threaded replies.</span>
          <button
            type="button"
            onClick={submitComment}
            disabled={postingComment || !newComment.trim()}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {postingComment ? 'Commenting...' : 'Comment'}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="theme-text-muted mt-4 text-sm">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="theme-text-muted mt-4 text-sm">No comments yet. Start the discussion above.</p>
      ) : (
        <div className="mt-4">{(commentsByParent.get(null) || []).map((comment) => renderComment(comment))}</div>
      )}
    </div>
  );
}
