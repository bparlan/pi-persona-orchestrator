#!/usr/bin/env python3
"""
Session Catchup Script for planning-with-files (Pi Edition)

Session-agnostic scanning: finds the most recent planning file update across
ALL sessions, then collects all conversation from that point forward through
all subsequent sessions until now.

Usage: python3 session-catchup.py [project-path]
"""

import json
import sys
import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple

PLANNING_FILES = ['task_plan.md', 'progress.md', 'findings.md']


def get_project_dir(project_path: str) -> Path:
    """Convert project path to Pi's session storage path format."""
    # expanduser handles ~, abspath handles relative paths
    abs_path = os.path.abspath(os.path.expanduser(project_path))
    
    # Pi treats paths as directory paths ending in /
    if not abs_path.endswith('/'):
        abs_path += '/'
    
    # Pi session directory encoding:
    # 1. Replace '/' with '-'
    # 2. Wrap with '-' at start and end
    # e.g. /Users/tmr/ -> -Users-tmr- -> --Users-tmr--
    sanitized = abs_path.replace('/', '-')
    sanitized = '-' + sanitized + '-'
    
    # Pi session storage is in ~/.pi/agent/sessions/
    return Path.home() / '.pi' / 'agent' / 'sessions' / sanitized


def get_sessions_sorted(project_dir: Path) -> List[Path]:
    """Get all session files sorted by modification time (newest first)."""
    if not project_dir.exists():
        # Fallback: try without trailing slash doubling? 
        # No, let's stick to the observed pattern.
        return []
        
    sessions = list(project_dir.glob('*.jsonl'))
    # Filter out any non-session files if any
    sessions = [s for s in sessions if s.stat().st_size > 0]
    return sorted(sessions, key=lambda p: p.stat().st_mtime, reverse=True)


def scan_for_planning_update(session_file: Path) -> Tuple[int, Optional[str]]:
    """
    Quickly scan a session file for planning file updates.
    Returns (line_number, filename) of last update, or (-1, None) if none found.
    """
    last_update_line = -1
    last_update_file = None

    try:
        with open(session_file, 'r') as f:
            for line_num, line in enumerate(f):
                # Quick pre-filter
                line_lower = line.lower()
                if '"write"' not in line_lower and '"edit"' not in line_lower:
                    continue

                try:
                    entry = json.loads(line)
                    if entry.get('type') != 'message':
                        continue
                    
                    message = entry.get('message', {})
                    if message.get('role') != 'assistant':
                        continue

                    content = message.get('content', [])
                    if not isinstance(content, list):
                        continue

                    for item in content:
                        if item.get('type') != 'toolCall':
                            continue
                        
                        tool_name = item.get('name', '').lower()
                        if tool_name not in ('write', 'edit'):
                            continue

                        args = item.get('arguments', {})
                        # Pi tools usually use 'path'
                        file_path = args.get('path', args.get('file_path', ''))
                        
                        for pf in PLANNING_FILES:
                            if file_path.endswith(pf):
                                last_update_line = line_num
                                last_update_file = pf
                                break
                except json.JSONDecodeError:
                    continue
    except Exception:
        pass

    return last_update_line, last_update_file


def extract_messages_from_session(session_file: Path, after_line: int = -1) -> List[Dict]:
    """
    Extract conversation messages from a session file.
    If after_line >= 0, only extract messages after that line.
    If after_line < 0, extract all messages.
    """
    result = []
    
    # Use short UUID for display
    session_id = session_file.stem.split('_')[-1][:8]

    try:
        with open(session_file, 'r') as f:
            for line_num, line in enumerate(f):
                if after_line >= 0 and line_num <= after_line:
                    continue

                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if entry.get('type') != 'message':
                    continue

                message = entry.get('message', {})
                role = message.get('role')
                content_list = message.get('content', [])

                if role == 'user':
                    text_content = ""
                    for item in content_list:
                        if item.get('type') == 'text':
                            text_content += item.get('text', '')
                    
                    if text_content:
                        # Skip system/command messages if they look internal
                        # But generally show user commands
                        if len(text_content) > 0:
                            result.append({
                                'role': 'user',
                                'content': text_content,
                                'line': line_num,
                                'session': session_id
                            })

                elif role == 'assistant':
                    text_content = ''
                    tool_uses = []

                    for item in content_list:
                        if item.get('type') == 'text':
                            text_content += item.get('text', '')
                        elif item.get('type') == 'toolCall':
                            tool_name = item.get('name', '')
                            args = item.get('arguments', {})
                            
                            if tool_name == 'edit':
                                tool_uses.append(f"Edit: {args.get('path', 'unknown')}")
                            elif tool_name == 'write':
                                tool_uses.append(f"Write: {args.get('path', 'unknown')}")
                            elif tool_name == 'bash':
                                cmd = args.get('command', '')[:80]
                                tool_uses.append(f"Bash: {cmd}")
                            elif tool_name == 'read':
                                tool_uses.append(f"Read: {args.get('path', 'unknown')}")
                            else:
                                tool_uses.append(f"{tool_name}")

                    if text_content or tool_uses:
                        result.append({
                            'role': 'assistant',
                            'content': text_content[:600] if text_content else '',
                            'tools': tool_uses,
                            'line': line_num,
                            'session': session_id
                        })
    except Exception:
        pass

    return result


def main():
    project_path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    project_dir = get_project_dir(project_path)

    if not project_dir.exists():
        # print(f"Session directory not found: {project_dir}")
        return

    sessions = get_sessions_sorted(project_dir)
    if len(sessions) < 2:
        return

    # Skip the current session (most recently modified = index 0)
    previous_sessions = sessions[1:]

    # Find the most recent planning file update across ALL previous sessions
    # Sessions are sorted newest first, so we scan in order
    update_session = None
    update_line = -1
    update_file = None
    update_session_idx = -1

    for idx, session in enumerate(previous_sessions):
        line, filename = scan_for_planning_update(session)
        if line >= 0:
            update_session = session
            update_line = line
            update_file = filename
            update_session_idx = idx
            break

    if not update_session:
        # No planning file updates found in any previous session
        return

    # Collect ALL messages from the update point forward, across all sessions
    all_messages = []

    # 1. Get messages from the session with the update (after the update line)
    messages_from_update_session = extract_messages_from_session(update_session, after_line=update_line)
    all_messages.extend(messages_from_update_session)

    # 2. Get ALL messages from sessions between update_session and current
    # These are sessions[1:update_session_idx] (newer than update_session)
    intermediate_sessions = previous_sessions[:update_session_idx]

    # Process from oldest to newest for correct chronological order
    for session in reversed(intermediate_sessions):
        messages = extract_messages_from_session(session, after_line=-1)  # Get all messages
        all_messages.extend(messages)

    if not all_messages:
        return

    # Output catchup report
    print("\n[planning-with-files] SESSION CATCHUP DETECTED")
    print(f"Last planning update: {update_file} in session {update_session.stem.split('_')[-1][:8]}...")

    sessions_covered = update_session_idx + 1
    if sessions_covered > 1:
        print(f"Scanning {sessions_covered} sessions for unsynced context")

    print(f"Unsynced messages: {len(all_messages)}")

    print("\n--- UNSYNCED CONTEXT ---")

    # Show up to 100 messages
    MAX_MESSAGES = 100
    if len(all_messages) > MAX_MESSAGES:
        print(f"(Showing last {MAX_MESSAGES} of {len(all_messages)} messages)\n")
        messages_to_show = all_messages[-MAX_MESSAGES:]
    else:
        messages_to_show = all_messages

    current_session = None
    for msg in messages_to_show:
        # Show session marker when it changes
        if msg.get('session') != current_session:
            current_session = msg.get('session')
            print(f"\n[Session: {current_session}...]")

        if msg['role'] == 'user':
            print(f"USER: {msg['content'][:300]}")
        else:
            if msg.get('content'):
                print(f"PI: {msg['content'][:300]}")
            if msg.get('tools'):
                print(f"  Tools: {', '.join(msg['tools'][:4])}")

    print("\n--- RECOMMENDED ---")
    print("1. Run: git diff --stat")
    print("2. Read: task_plan.md, progress.md, findings.md")
    print("3. Update planning files based on above context")
    print("4. Continue with task")


if __name__ == '__main__':
    main()
