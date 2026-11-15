-- Partner rooms:
--   practices_sheet_filter_*  the connected sheet may list every customer's
--                             practices (a Salesforce report); keep only the
--                             rows where this column contains this value.
--   revops_slack_mention      who to mention in Slack when the customer's
--                             list has practices Salesforce is missing
--                             (a Slack user-group id S…, or a user id U…).
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS practices_sheet_filter_column text;
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS practices_sheet_filter_value text;
ALTER TABLE lp_room_settings ADD COLUMN IF NOT EXISTS revops_slack_mention text;
