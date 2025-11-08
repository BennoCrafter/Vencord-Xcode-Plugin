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
import { ApplicationAssetUtils, FluxDispatcher, Forms } from "@webpack/common";

const Native = VencordNative.pluginHelpers.AppleMusicRichPresence as PluginNative<typeof import("./native")>;

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
    },

    updatePresence() {
        this.getActivity().then(activity => { setActivity(activity); });
    },

    async getActivity(): Promise<Activity | null> {
        const xcodeProjectData = await Native.fetchXcodeProjectData();
        if (!xcodeProjectData) return null;

        const [largeImageAsset, smallImageAsset] = await Promise.all([
            getImageAsset(settings.store.largeImageType, xcodeProjectData),
            getImageAsset(settings.store.smallImageType, xcodeProjectData)
        ]);

        const assets: ActivityAssets = {};


        assets.large_text = "Xcode";
        assets.small_text = `In ${xcodeProjectData.workspace}\n${xcodeProjectData.file != undefined ? `Working on: ${xcodeProjectData.file}` : ""}`;
        assets.large_image = largeImageAsset;

        const buttons: ActivityButton[] = [];

        if (settings.store.enableButtons) {
            //buttons.push({
            //    label: "Listen on Apple Music",
            //    url: trackData.appleMusicLink,
            //});
        }

        return {
            application_id: applicationId,

            name: "Xcode",
            details: `In ${xcodeProjectData.workspace}\n${xcodeProjectData.file != undefined ? `Working on: ${xcodeProjectData.file}` : ""}`,
            assets,

            buttons: buttons.length ? buttons.map(v => v.label) : undefined,
            metadata: buttons.length ? { button_urls: buttons.map(v => v.url) } : undefined,

            type: ActivityType.PLAYING,
            status_display_type: {
                "off": ActivityStatusDisplayType.NAME,
                "artist": ActivityStatusDisplayType.STATE,
                "track": ActivityStatusDisplayType.DETAILS
            }[settings.store.statusDisplayType],
            flags: ActivityFlags.INSTANCE,
        };
    }
});
