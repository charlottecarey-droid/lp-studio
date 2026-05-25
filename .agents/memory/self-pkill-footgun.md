---
name: pkill/pgrep self-match foot-gun
description: How to kill background processes from a shell tool without SIGKILL'ing the shell itself.
---

# pkill/pgrep self-match foot-gun

`pkill -f <pattern>` and `pgrep -f <pattern>` match against **the full argv of every
process**, which includes the very shell wrapper executing your tool call. If your
pattern (or the bash `-c` string that contains it) appears in that argv, you will
kill your own shell — the bash tool returns exit code 137 with no log lines saved.

## The rule
Never use `pkill -f <literal>` or `pgrep -f <literal>` where `<literal>` is a substring
of any command being typed into the shell — including the kill command itself.

## How to apply
- Use **awk on `ps`** with a bracket trick that prevents the pattern from matching
  itself:
  ```bash
  ps -eo pid,comm,args | awk '/backfill[-]published/{print $1}' | xargs -r kill -9
  ```
  The `[-]` makes the regex literal `-` but breaks the self-match because the awk
  process's own argv contains `[-]`, not `-`.
- Or match on `comm` (basename) instead of full argv:
  ```bash
  ps -eo pid,comm | awk '$2=="node"{print $1}'
  ```
- Or capture the PID at spawn time (`echo $! >/tmp/pid; disown`) and `kill $(cat /tmp/pid)`.

## Why
The Replit bash tool wraps your script in `bash --rcfile ... -c "<your script>"`.
That `<your script>` text is visible to every other process's `ps -ef` view via
`/proc/<pid>/cmdline`. `pkill -f` and `pgrep -f` walk that view and match anything,
including their own siblings in the pipeline.
