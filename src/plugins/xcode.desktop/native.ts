/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFile } from "child_process";
import { promisify } from "util";

import type { XcodeProjectData } from ".";

const exec = promisify(execFile);

async function applescript(cmds: string[]) {
    const { stdout } = await exec("osascript", cmds.map(c => ["-e", c]).flat());
    return stdout;
}


export async function fetchXcodeProjectData(): Promise<XcodeProjectData | null> {
    try {
        await exec("pgrep", ["^Xcode$"]);
    } catch (error) {
        return null;
    }

    const currentWorkspaceName: string = await applescript(['tell application "Xcode"', "get active workspace document", "end tell"])
        .then(out => out.trim());

    const workspaceFileName: string = await applescript(['tell application "Xcode"', "get name of windows whose index is 1", "end tell"])
        .then(out => out.trim());

    const parts: string[] = workspaceFileName.split(/—|–|-/).map(p => p.trim()).filter(Boolean);
    const [workspaceParsed, fileName]: [string, string] = [parts[0] ?? "", parts[1] ?? ""]; // workspaceParsed is the same as currentWorkspaceName but without .xcodeproj suffix

    return {
        workspace: workspaceParsed,
        file: fileName === currentWorkspaceName ? undefined : fileName
    };
}


