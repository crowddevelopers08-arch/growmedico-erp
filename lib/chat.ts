export const DIRECT_CHANNEL_PREFIX = "dm__"
export const GROUP_DM_PREFIX = "gdm__"

export function buildDirectChannelName(userIds: string[]) {
  const normalized = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean))).sort()
  return `${DIRECT_CHANNEL_PREFIX}${normalized.join("__")}`
}

export function parseDirectChannelName(name: string) {
  if (!name.startsWith(DIRECT_CHANNEL_PREFIX)) return null

  const ids = name
    .slice(DIRECT_CHANNEL_PREFIX.length)
    .split("__")
    .map((id) => id.trim())
    .filter(Boolean)

  return ids.length >= 2 ? ids : null
}

export function isDirectChannelName(name: string) {
  return parseDirectChannelName(name) !== null
}

export function isGroupDmChannelName(name: string) {
  return name.startsWith(GROUP_DM_PREFIX)
}

/**
 * Can this user see a group channel?
 *
 * An empty member list means the channel predates per-channel membership (or
 * was deliberately left open) and stays visible to everyone — that keeps the
 * channels people already use from vanishing. Once a channel has members, only
 * they get in.
 */
export function canAccessChannel(memberIds: string[] | null | undefined, userId: string) {
  if (!memberIds || memberIds.length === 0) return true
  return memberIds.includes(userId)
}

export interface GroupDmMeta {
  gdm: true
  title: string
  members: string[]
}

export function parseGroupDmMeta(description: string | null | undefined): GroupDmMeta | null {
  if (!description) return null
  try {
    const parsed = JSON.parse(description)
    if (parsed?.gdm === true && typeof parsed.title === "string" && Array.isArray(parsed.members)) {
      return parsed as GroupDmMeta
    }
    return null
  } catch {
    return null
  }
}
