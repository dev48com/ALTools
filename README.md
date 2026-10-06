# Dev48: AL Tools for Visual Studio Code

A Visual Studio Code extension that provides small utilities for Business Central (AL) developers.

## Commands

| Command | Shortcut | Description |
| --- | --- | --- |
| **Dev48: Insert Date** | `Ctrl+Shift+I` (`Cmd+Shift+I` on macOS) | Inserts the current date and time at the editor cursor. |
| **Dev48: Update Version Date in Active Project** | `Ctrl+Shift+U` (`Cmd+Shift+U` on macOS) | Updates the version in the active file's project's `app.json`. |

The version command requires an active file in a local workspace. It searches from that file's directory up to the workspace folder for `app.json`, and updates only the final dot-separated component of its top-level `version` property. Earlier components and the file's formatting are preserved. For example, `1.2.3.4` becomes `1.2.3.<date>` using the configured date format. The updated file is saved automatically and does not need to be open in the editor.

## Date format

Set `dev48-altools.dateFormat` in VS Code settings to choose the format used by both commands. The default is `YYDDDHHmm`.

| Token | Meaning |
| --- | --- |
| `YYYY` | Four-digit year |
| `YY` | Two-digit year |
| `DDD` | Day of year, from `001` to `365` or `366` |
| `MM` | Two-digit month |
| `DD` | Two-digit day of month |
| `HH` | Two-digit hour (24-hour clock) |
| `mm` | Two-digit minute |
| `ss` | Two-digit second |

Tokens are case-sensitive. Any characters that are not tokens are inserted literally by **Insert Date**. For example, `YYYY-MM-DD` produces a calendar date, while `YYDDDHHmm` produces a two-digit year, day of year, hour, and minute.

When updating a version, non-digit characters in the formatted date are removed so the final version component contains only digits. The format must produce at least one digit for this command.
