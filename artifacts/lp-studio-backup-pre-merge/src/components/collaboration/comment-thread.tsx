import { useState } from "react";
import { MessageSquare, CheckCircle2, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CommentThread, BlockComments, getAuthorName, setAuthorName } from "@/hooks/use-collaboration";

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface CommentItemProps {
  thread: CommentThread;
  onReply: (message: string) => void;
  onResolve: () => void;
}

function CommentItem({ thread, onReply, onResolve }: CommentItemProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyAuthor, setReplyAuthor] = useState(() => getAuthorName());

  const handleReply = () => {
    if (!replyText.trim()) return;
    setAuthorName(replyAuthor);
    onReply(replyText.trim());
    setReplyText("");
    setShowReply(false);
  };

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${thread.comment.resolved ? "opacity-60 bg-muted/30" : "bg-background"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-foreground">{thread.comment.authorName}</span>
            <span className="text-xs text-muted-foreground">{formatTime(thread.comment.createdAt)}</span>
            {thread.comment.resolved && (
              <Badge variant="secondary" className="text-xs py-0">Resolved</Badge>
            )}
          </div>
          <p className="text-sm text-foreground/90">{thread.comment.message}</p>
        </div>
        {!thread.comment.resolved && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-green-600 shrink-0"
            onClick={onResolve}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Resolve
          </Button>
        )}
      </div>

      {thread.replies.length > 0 && (
        <div className="ml-3 pl-3 border-l-2 border-border/60 space-y-2">
          {thread.replies.map(reply => (
            <div key={reply.id} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs text-foreground">{reply.authorName}</span>
                <span className="text-xs text-muted-foreground">{formatTime(reply.createdAt)}</span>
              </div>
              <p className="text-xs text-foreground/90">{reply.message}</p>
            </div>
          ))}
        </div>
      )}

      {!thread.comment.resolved && (
        <div>
          {showReply ? (
            <div className="space-y-2">
              {!getAuthorName() && (
                <Input
                  placeholder="Your name"
                  value={replyAuthor}
                  onChange={e => { setReplyAuthor(e.target.value); }}
                  className="text-xs h-7"
                />
              )}
              <Textarea
                placeholder="Write a reply..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                className="min-h-[56px] text-sm resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={handleReply} disabled={!replyText.trim() || !replyAuthor.trim()}>Reply</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowReply(false); setReplyText(""); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => setShowReply(true)}
            >
              <Reply className="w-3 h-3 mr-1" />
              Reply
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface CommentsPanelProps {
  blockComments: BlockComments | undefined;
  blockIndex: number;
  onAddComment: (params: { blockIndex: number; authorName: string; message: string; parentId?: number }) => Promise<void>;
  onResolve: (commentId: number) => Promise<void>;
}

export function CommentsPanel({ blockComments, blockIndex, onAddComment, onResolve }: CommentsPanelProps) {
  const [message, setMessage] = useState("");
  const [authorName, setAuthorNameState] = useState(() => getAuthorName());

  const handleAuthorChange = (name: string) => {
    setAuthorNameState(name);
    setAuthorName(name);
  };

  const handleAdd = async () => {
    if (!message.trim() || !authorName.trim()) return;
    await onAddComment({ blockIndex, authorName: authorName.trim(), message: message.trim() });
    setMessage("");
  };

  const handleReply = async (thread: CommentThread, replyMessage: string) => {
    if (!replyMessage.trim() || !authorName.trim()) return;
    await onAddComment({ blockIndex, authorName: authorName.trim(), message: replyMessage, parentId: thread.comment.id });
  };

  const threads = blockComments?.threads ?? [];
  const activeThreads = threads.filter(t => !t.comment.resolved);
  const resolvedThreads = threads.filter(t => t.comment.resolved);

  return (
    <div className="w-80 bg-background border border-border rounded-xl shadow-xl p-4 space-y-4 max-h-[480px] flex flex-col">
      <div className="flex items-center gap-2 shrink-0">
        <MessageSquare className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm">Comments</span>
        {threads.length > 0 && (
          <Badge variant="secondary" className="text-xs py-0 ml-auto">{threads.length}</Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {activeThreads.length === 0 && resolvedThreads.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No comments yet. Add the first one below.</p>
        )}
        {activeThreads.map(thread => (
          <CommentItem
            key={thread.comment.id}
            thread={thread}
            onReply={(msg) => handleReply(thread, msg)}
            onResolve={() => onResolve(thread.comment.id)}
          />
        ))}
        {resolvedThreads.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Resolved ({resolvedThreads.length})</p>
            {resolvedThreads.map(thread => (
              <CommentItem
                key={thread.comment.id}
                thread={thread}
                onReply={(msg) => handleReply(thread, msg)}
                onResolve={() => onResolve(thread.comment.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 shrink-0 border-t pt-3">
        <Input
          placeholder="Your name"
          value={authorName}
          onChange={e => handleAuthorChange(e.target.value)}
          className="text-sm h-8"
        />
        <Textarea
          placeholder="Add a comment... (Ctrl+Enter to submit)"
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="min-h-[64px] text-sm resize-none"
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd(); }}
        />
        <Button
          size="sm"
          className="w-full h-8 text-xs"
          onClick={handleAdd}
          disabled={!message.trim() || !authorName.trim()}
        >
          Add Comment
        </Button>
      </div>
    </div>
  );
}

interface CommentBadgeProps {
  count: number;
  onClick: () => void;
  active?: boolean;
}

export function CommentBadge({ count, onClick, active }: CommentBadgeProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1 rounded-full shadow-md border transition-all duration-150
        ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary hover:text-primary"}
        px-2 py-1 text-xs font-medium
      `}
    >
      <MessageSquare className="w-3.5 h-3.5" />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
