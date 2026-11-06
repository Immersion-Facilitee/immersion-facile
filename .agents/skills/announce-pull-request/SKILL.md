
---
name: announce-pr
description: Announce a GitHub pull request in Slack using a standardized message format.
---

# Announce a Pull Request

Use this skill when the user asks to announce or share a GitHub pull request in Slack.

## Instructions

1. **Identify the pull request**
   - If the user provides a GitHub PR URL, use it.
   - Otherwise, find the PR associated with the current Git branch.

2. **Retrieve PR details**
   - Use GitHub CLI to retrieve the exact PR title and URL:
     ```bash
     gh pr view <PR_URL> --json title,url
     ```
   - Do not modify or paraphrase the PR title.

3. **Prepare the Slack message**
   - Use the following exact format on a single line:

     ```
     <!subteam^S089GE2GKEH> 🔀 PR <PR_URL|PR_TITLE>
     ```

   - Replace `PR_URL` with the retrieved value
   - Replace `PR_TITLE` with the retrieved value summarized (no # and ids) and ask to use it as default or let the user replace it
   - Escape Slack special characters in the PR title (`&`, `<`, `>`).
   - Do not add any additional text, formatting, or commentary.

4. **Identify the destination**
   - Use the Slack channel #if-dev

5. **Request confirmation**
   - Display the formatted message and destination channel.
   - Ask for explicit confirmation before publishing.

6. **Publish the message**
   - Use the official Slack MCP server.
   - Post using the authenticated user's identity, never a bot identity.
   - Ensure the `@if-devs` user group is properly mentioned.
   - Do not publish if user-authenticated posting is unavailable.

7. **Confirm publication**
   - Return the permalink to the published Slack message.
   - Never claim success unless the Slack MCP tool confirms publication.

## Constraints

- Never invent PR titles or URLs.
- Never paraphrase the PR title.
- Never publish without confirmation.
- Never publish duplicate announcements.
- Never post as a bot.
- If GitHub or Slack access fails, explain the issue instead of publishing an incomplete message.
