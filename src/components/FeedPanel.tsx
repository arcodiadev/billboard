import type { ReactNode } from 'react';
import type { FeedLine } from '../types';
import { formatTimeHM } from '../format';

interface FeedPanelProps {
  feed: FeedLine[];
  /** Revs present in the initial snapshot — streamed lines fade in as new. */
  initialRevs: ReadonlySet<number>;
}

export function FeedPanel({ feed, initialRevs }: FeedPanelProps): ReactNode {
  return (
    <section className="panel feed-panel" aria-labelledby="h-feed">
      <div className="panel-head">
        <h2 id="h-feed">Live feed</h2>
        <span className="count">newest first</span>
      </div>
      <ul className="feed">
        {feed.map((line) => (
          <li key={line.rev} className={initialRevs.has(line.rev) ? undefined : 'new'}>
            <time>{formatTimeHM(new Date(line.at))}</time>
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
      <div className="feed-note">After a reconnect, missed changes are filled in from where you left off.</div>
    </section>
  );
}
