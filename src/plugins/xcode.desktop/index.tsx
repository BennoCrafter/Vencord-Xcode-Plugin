/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs, IS_MAC } from "@utils/constants";
import definePlugin, { OptionType, PluginNative, ReporterTestable } from "@utils/types";
import { Activity, ActivityAssets, ActivityButton } from "@vencord/discord-types";
import { ActivityFlags, ActivityStatusDisplayType, ActivityType } from "@vencord/discord-types/enums";
import { ApplicationAssetUtils, FluxDispatcher } from "@webpack/common";

const Native = VencordNative.pluginHelpers.XcodeRichPresence as PluginNative<typeof import("./native")>;
let xcodeStartTimestamp: number | null = null;

const defaultXcodeIcon = "https://raw.githubusercontent.com/BennoCrafter/Vencord-Xcode-Plugin/refs/heads/xcode-icon/assets/xcode.png";

const fileSuffixToLanguage: Record<string, string> = {
    "py": "python",
    "js": "javascript",
    "ts": "typescript",
    "java": "java",
    "c": "c",
    "cpp": "c++",
    "cs": "c#",
    "swift": "swift",
    "m": "objective-c",
    "rb": "ruby",
    "go": "go",
    "php": "php",
    "html": "html",
    "css": "css",
    "json": "json",
    "xml": "xml",
    "sh": "shell script",
    "rs": "rust",
    "kt": "kotlin",
    "scala": "scala",
    "dart": "dart",
    "lua": "lua",
    "r": "r",
    "pl": "perl",
    "sql": "sql",
    "md": "markdown",
    "txt": "text",
};


export class XcodeProjectData {
    workspace: string;
    file?: string;

    constructor(workspace: string, file?: string) {
        this.workspace = workspace;
        this.file = file;
    }

    fileSuffix(): string | undefined {
        if (!this.file) return undefined;
        const parts = this.file.split(".");
        if (parts.length === 0) return undefined;

        const suffix = parts.pop()?.toLowerCase();
        if (suffix === undefined) return undefined;
        if (suffix === "xcodeproj" || suffix === "xcworkspace") return undefined;
        const language = fileSuffixToLanguage[suffix] || suffix;
        return language;
    }
}


const applicationId = "1436859626644570125";

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: "XcodeRichPresence",
    });
}

const settings = definePluginSettings({
    refreshInterval: {
        type: OptionType.SLIDER,
        description: "The interval between activity refreshes (seconds)",
        markers: [1, 2, 2.5, 3, 5, 10, 15],
        default: 5,
        restartNeeded: true,
    },
    enableButtons: {
        type: OptionType.BOOLEAN,
        description: "Enable activity buttons",
        default: true,
    },
    customAppName: {
        type: OptionType.STRING,
        description: "Custom name for the Xcode app in Rich Presence",
        default: "Xcode",
    },
    showFileSuffixImage: {
        type: OptionType.BOOLEAN,
        description: "Show an icon based on the file type (like .swift, .m, etc.)",
        default: true,
    },
    enablePrivacyMode: {
        type: OptionType.BOOLEAN,
        description: "Hide file names from Rich Presence",
        default: false,
    },
    enableWorkspaceName: {
        type: OptionType.BOOLEAN,
        description: "Show workspace name in the activity details",
        default: true,
    },
});

async function getImageAsset(source: string) {
    return ApplicationAssetUtils.fetchAssetIds(applicationId, [source]).then(ids => ids[0]);
}

async function getSmallImageAsset(data: XcodeProjectData) {
    return getImageAsset(defaultXcodeIcon);
}

async function getLargeImageAsset(data: XcodeProjectData) {
    if (settings.store.showFileSuffixImage && data.fileSuffix()) {
        return getImageAsset(`https://raw.githubusercontent.com/LeonardSSH/vscord/main/assets/icons/${data.fileSuffix()}.png`);
    }
    return getImageAsset(defaultXcodeIcon);
}

export default definePlugin({
    name: "XcodeRichPresence",
    description: "Xcode rich presence for Xcode!",
    authors: [Devs.bennowo],
    hidden: !IS_MAC,
    reporterTestable: ReporterTestable.None,
    settings,

    start() {
        this.updatePresence();
        this.updateInterval = setInterval(() => this.updatePresence(), settings.store.refreshInterval * 1000);
    },

    stop() {
        clearInterval(this.updateInterval);
        FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: null });
        xcodeStartTimestamp = null;
    },

    async updatePresence() {
        const activity = await this.getActivity();
        setActivity(activity);
    },

    async getActivity(): Promise<Activity | null> {
        const rawData = await Native.fetchXcodeProjectData();
        if (!rawData) {
            xcodeStartTimestamp = null;
            return null;
        }

        const xcodeProjectData = new XcodeProjectData(rawData.workspace, rawData.file);

        if (!xcodeStartTimestamp) {
            xcodeStartTimestamp = Date.now();
        }

        const [largeImageAsset, smallImageAsset] = await Promise.all([
            getLargeImageAsset(xcodeProjectData),
            getSmallImageAsset(xcodeProjectData),
        ]);

        const assets: ActivityAssets = {
            small_text: settings.store.customAppName,
            large_text: xcodeProjectData.fileSuffix()
                ? `.${xcodeProjectData.fileSuffix()} file`
                : "Xcode Project",
            small_image: smallImageAsset,
            large_image: largeImageAsset,
        };

        const buttons: ActivityButton[] = [];
        if (settings.store.enableButtons) {
        }

        return {
            application_id: applicationId,
            name: settings.store.customAppName,
            details: settings.store.enableWorkspaceName ? `In ${xcodeProjectData.workspace}` : undefined,
            state: !settings.store.enablePrivacyMode && xcodeProjectData.file
                ? `Working on: ${xcodeProjectData.file}`
                : undefined,
            assets,
            buttons: buttons.length ? buttons.map(v => v.label) : undefined,
            metadata: buttons.length ? { button_urls: buttons.map(v => v.url) } : undefined,
            type: ActivityType.PLAYING,
            timestamps: { start: xcodeStartTimestamp },
            status_display_type: ActivityStatusDisplayType.NAME,
            flags: ActivityFlags.INSTANCE,
        };
    },
});
