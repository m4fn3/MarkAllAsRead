import {Plugin, registerPlugin} from 'enmity/managers/plugins'
import {React, Toasts} from 'enmity/metro/common'
import {create} from 'enmity/patcher'
// @ts-ignore
import manifest, {name as plugin_name} from '../manifest.json'
import Settings from "./components/Settings"
import {bulk, filters} from "enmity/metro"
import {findInReactTree} from "enmity/utilities"
import {getIDByName} from "enmity/api/assets"
import {get} from "enmity/api/settings"
import {View} from "enmity/components"

const Patcher = create('MarkAllAsRead')

const [
    AckUtils,
    ChannelStore,
    ReadStateStore
] = bulk(
    filters.byProps("bulkAck"),
    filters.byProps("getChannel"),
    filters.byProps("getAllReadStates")
)

const ReadIcon = getIDByName("ic_rulebook_16px")

const MarkAllAsRead: Plugin = {
    ...manifest,
    onStart() {
        const unpatchView = Patcher.after(View, "render", (self, args, res) => {
            const GuildPopoutMenu = findInReactTree(res, r => r.props?.guildId && r.props?.yPos && r.props?.onClose)
            if (GuildPopoutMenu) {
                Patcher.after(GuildPopoutMenu.type, 'render', (_, args, res) => {
                    res.props.rows.unshift({
                        "icon": ReadIcon,
                        "text": "MarkAllAsRead",
                        "onClick": () => {
                            // ported from https://github.com/Tharki-God/MarkAllAsRead
                            let toRead = []
                            const AllReadStates = ReadStateStore.getAllReadStates().map((m) => ({...m,}))
                            const OnlyUnreadOrMentions = AllReadStates.filter((m) => ReadStateStore.hasUnread(m.channelId))
                            if (get(plugin_name, "dm", true)) {
                                const UnreadDMs = OnlyUnreadOrMentions.filter((m) => ChannelStore.getChannel(m.channelId)?.isDM())
                                const DMsToRead = UnreadDMs.map((m) => ({channelId: m.channelId, messageId: m._lastMessageId}))
                                toRead.push(...DMsToRead)
                            }
                            if (get(plugin_name, "server", true)) {
                                const UnreadGuildChannels = OnlyUnreadOrMentions.filter((m) => Boolean(ChannelStore.getChannel(m.channelId)?.getGuildId()))
                                const GuildChannelsToRead = UnreadGuildChannels.map((m) => ({channelId: m.channelId, messageId: m._lastMessageId}))
                                toRead.push(...GuildChannelsToRead)
                            }
                            AckUtils.bulkAck(toRead)
                            Toasts.open({
                                content: `Marked all messages as read`,
                                source: getIDByName('ic_check_24px')
                            })
                        }
                    })
                })
                unpatchView()
            }
        })
    },
    onStop() {
        Patcher.unpatchAll()
    }
    ,
    getSettingsPanel({settings}) {
        return <Settings settings={settings}/>
    }
}

registerPlugin(MarkAllAsRead)
