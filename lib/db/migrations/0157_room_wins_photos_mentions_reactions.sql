-- Wins feed: photos, tagging people, and emoji reactions.
--   lp_room_wins.images            hosted image paths shown on the post
--   lp_room_wins.mentions          names of the people tagged ("@Dana Lee")
--   lp_room_win_comments.mentions  the same, for a comment
--   lp_room_win_likes.emoji        which reaction; a person can add several
--                                  different ones to a post, each once
ALTER TABLE lp_room_wins ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE lp_room_wins ADD COLUMN IF NOT EXISTS mentions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE lp_room_win_comments ADD COLUMN IF NOT EXISTS mentions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE lp_room_win_likes ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '❤️';
DROP INDEX IF EXISTS lp_room_win_likes_win_email_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS lp_room_win_likes_win_email_emoji_uniq ON lp_room_win_likes (win_id, email, emoji);
