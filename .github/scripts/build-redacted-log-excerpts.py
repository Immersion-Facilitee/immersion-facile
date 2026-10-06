import json
import sys
import zipfile
from urllib.parse import quote

LINES_BEFORE_FINDING = 15
LINES_AFTER_FINDING = 5
MAX_LINE_LENGTH = 300
MAX_MESSAGE_LENGTH = 3500
MAX_MESSAGES = 10
REDACTED = "REDACTED"


def secret_variants(secret):
    return {secret, quote(secret, safe="")}


def redact(text, secrets):
    for secret in sorted(secrets, key=len, reverse=True):
        text = text.replace(secret, REDACTED)
    return text


def escape_for_slack(text):
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("```", "'''")
    )


def split_into_messages(text):
    messages = [""]
    for line in text.splitlines():
        if len(messages[-1]) + len(line) + 1 > MAX_MESSAGE_LENGTH:
            messages.append("")
        messages[-1] += line + "\n"
    return messages[:MAX_MESSAGES]


def merge_windows(line_numbers, line_count):
    windows = []
    for line_number in sorted(line_numbers):
        start = max(1, line_number - LINES_BEFORE_FINDING)
        end = min(line_count, line_number + LINES_AFTER_FINDING)
        if windows and start <= windows[-1][1] + 1:
            windows[-1] = (windows[-1][0], max(windows[-1][1], end))
        else:
            windows.append((start, end))
    return windows


def build_excerpts(archive_path, findings):
    secrets = set()
    for finding in findings:
        if finding["Secret"]:
            secrets |= secret_variants(finding["Secret"])

    line_numbers_by_entry = {}
    for finding in findings:
        entry = finding["File"].split("!", 1)[1]
        line_numbers_by_entry.setdefault(entry, set()).add(finding["StartLine"])

    excerpts = []
    with zipfile.ZipFile(archive_path) as archive:
        for entry, line_numbers in sorted(line_numbers_by_entry.items()):
            lines = archive.read(entry).decode("utf-8", "replace").splitlines()
            for start, end in merge_windows(line_numbers, len(lines)):
                excerpt_lines = [
                    redact(line, secrets)[:MAX_LINE_LENGTH]
                    for line in lines[start - 1 : end]
                ]
                excerpts.append(
                    f"{entry}, lignes {start} à {end}\n" + "\n".join(excerpt_lines)
                )

    output = "\n\n".join(excerpts)
    if any(secret in output for secret in secrets):
        raise SystemExit("A detected secret is still present in the excerpts")
    return escape_for_slack(output)


def main():
    archive_path, findings_path, output_path = sys.argv[1:4]
    with open(findings_path, encoding="utf-8") as findings_file:
        findings = json.load(findings_file)
    with open(output_path, "w", encoding="utf-8") as output_file:
        json.dump(split_into_messages(build_excerpts(archive_path, findings)), output_file)


main()
