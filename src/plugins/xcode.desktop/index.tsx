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

export interface XcodeProjectData {
    workspace: string;
    file?: string;
}

interface AssetImageOption {
    showFileSuffixImage: boolean;
}

const applicationId = "1239490006054207550";

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: "XcodeRichPresence",
    });
}

const settings = definePluginSettings({
    statusDisplayType: {
        description: "Show the track / artist name in the member list",
        type: OptionType.SELECT,
        options: [
            {
                label: "Don't show (shows generic listening message)",
                value: "off",
                default: true
            },
            {
                label: "Show artist name",
                value: "artist"
            },
            {
                label: "Show track name",
                value: "track"
            }
        ]
    },
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
    }
});


function getImageAsset(type: AssetImageOption, data: XcodeProjectData) {
    const source = ""; // TODO

    if (!source) return undefined;

    return ApplicationAssetUtils.fetchAssetIds(applicationId, [source]).then(ids => ids[0]);
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
        this.updateInterval = setInterval(() => { this.updatePresence(); }, settings.store.refreshInterval * 1000);
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
        const xcodeProjectData = await Native.fetchXcodeProjectData();
        if (!xcodeProjectData) {
            xcodeStartTimestamp = null; // reset when no project
            return null;
        }

        // Initialize start timestamp only once
        if (!xcodeStartTimestamp) {
            xcodeStartTimestamp = Date.now();
        }

        const assets: ActivityAssets = {
            large_text: "Xcode",
            small_text: `In ${xcodeProjectData.workspace}${xcodeProjectData.file ? `\nWorking on: ${xcodeProjectData.file}` : ""}`,
        };

        const buttons: ActivityButton[] = [];
        if (settings.store.enableButtons) {
            // add buttons if needed
        }

        return {
            application_id: applicationId,
            name: "Xcode",
            details: `In ${xcodeProjectData.workspace}`,
            state: xcodeProjectData.file ? `Working on: ${xcodeProjectData.file}` : "",
            assets,
            buttons: buttons.length ? buttons.map(v => v.label) : undefined,
            metadata: buttons.length ? { button_urls: buttons.map(v => v.url) } : undefined,
            type: ActivityType.PLAYING,
            timestamps: { start: xcodeStartTimestamp },
            status_display_type: {
                off: ActivityStatusDisplayType.NAME,
                artist: ActivityStatusDisplayType.STATE,
                track: ActivityStatusDisplayType.DETAILS
            }[settings.store.statusDisplayType],
            flags: ActivityFlags.INSTANCE,
        };
    }
});
