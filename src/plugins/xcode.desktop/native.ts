/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFile } from "child_process";
import { promisify } from "util";

import { XcodeProjectData } from ".";

const exec = promisify(execFile);

async function applescript(cmds: string[]): Promise<string> {
    const { stdout } = await exec("osascript", cmds.map(c => ["-e", c]).flat());
    return stdout.trim();
}

export async function fetchXcodeProjectData(): Promise<XcodeProjectData | null> {
    // Check if Xcode is running
    try {
        await exec("pgrep", ["-x", "Xcode"]);
    } catch {
        return null;
    }

    // Get the active workspace document
    const currentWorkspaceName = await applescript([
        'tell application "Xcode"',
        'if exists active workspace document then name of active workspace document else ""',
        "end tell"
    ]);

    if (!currentWorkspaceName) return null;

    // Get the front window title (usually file or workspace name)
    const windowTitle = await applescript([
        'tell application "Xcode"',
        'if (count of windows) > 0 then name of window 1 else ""',
        "end tell"
    ]);

    const parts = windowTitle.split(/—|–|-/).map(p => p.trim()).filter(Boolean);
    const [workspaceParsed, fileName] = [parts[0] ?? currentWorkspaceName, parts[1] ?? ""];

    return new XcodeProjectData(
        workspaceParsed,
        fileName !== currentWorkspaceName ? fileName : undefined
    );
}
