import type { ReactNode } from "react";

/**
 * A Slack post as it will look in the channel: the app's avatar and name, a
 * bold header, the message with Slack's own formatting applied (*bold*, bullet
 * lines, <url|label> links), and the small context line. A plain block of
 * text with asterisks in it does not tell a rep what their team will see.
 */

/** One line of Slack mrkdwn as React nodes: *bold* and <url|label>. Nothing is injected as HTML. */
export function slackInline(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*([^*\n]+)\*|<(https?:\/\/[^|>\s]+)\|([^>]+)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={k++} className="font-bold">{m[1]}</strong>);
    else out.push(<a key={k++} href={m[2]} target="_blank" rel="noreferrer" className="text-[#1264A3] hover:underline">{m[3]}</a>);
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function RoomSlackPreview({ header, text, context, channel }: { header: string; /** The message body, in Slack mrkdwn. */ text: string; /** The small grey line under the message. */ context?: string; /** The channel it posts to, by name, when known. */ channel?: string }) {
  // Paragraphs are separated by a blank line; inside one, each line stands alone and "• " lines are bullets.
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  const now = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (
    <div className="overflow-hidden rounded-lg border bg-white text-[#1D1C1D] shadow-sm" style={{ fontFamily: "Lato, 'Slack-Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }} data-room-slack-preview>
      <div className="flex items-center gap-1.5 border-b border-[#DDDDDD] px-4 py-2 text-[15px] font-bold">
        <span className="text-[#616061]">#</span>
        {channel || "your-hub-channel"}
      </div>
      <div className="flex gap-2 px-4 py-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#3F2E6B] text-[13px] font-black tracking-tight text-white" aria-hidden>LP</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-[15px] font-black">LP Studio</span>
            <span className="rounded-sm bg-[#DDDDDD] px-1 text-[10px] font-bold leading-4 text-[#616061]">APP</span>
            <span className="text-xs text-[#616061]">{now}</span>
          </div>
          <div className="mt-1 text-[18px] font-black leading-snug">{header}</div>
          <div className="mt-1.5 space-y-2.5 text-[15px] leading-[1.46668]">
            {paragraphs.map((p, i) => (
              <div key={i}>
                {p.split("\n").map((line, j) =>
                  /^\s*•\s+/.test(line) ? (
                    <div key={j} className="flex gap-2 pl-1">
                      <span aria-hidden>•</span>
                      <span className="min-w-0">{slackInline(line.replace(/^\s*•\s+/, ""))}</span>
                    </div>
                  ) : (
                    <div key={j}>{slackInline(line)}</div>
                  ),
                )}
              </div>
            ))}
          </div>
          {context && <div className="mt-2 text-[13px] text-[#616061]">{slackInline(context)}</div>}
        </div>
      </div>
    </div>
  );
}
