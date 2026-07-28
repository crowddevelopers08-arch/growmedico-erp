// Server-side LiveKit integration: access tokens + room lifecycle. Never import
// this into a client component — it holds the API secret.

import "server-only"
import { AccessToken, RoomServiceClient } from "livekit-server-sdk"

interface LiveKitConfig {
  apiKey: string
  apiSecret: string
  wsUrl: string
}

/** Read + validate config at call time so a missing env is a clear 500, not a
 *  crash at import. Throws with an actionable message when unconfigured. */
function config(): LiveKitConfig {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL
  if (!apiKey || !apiSecret || !wsUrl) {
    throw new Error(
      "LiveKit is not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET and NEXT_PUBLIC_LIVEKIT_URL."
    )
  }
  return { apiKey, apiSecret, wsUrl }
}

export interface TokenGrant {
  roomName: string
  identity: string
  name: string
  /** Video calls need camera publish; voice calls only mic. */
  canPublishVideo?: boolean
}

/**
 * Mint a short-lived join token scoped to a single room and identity. The token
 * is what the browser hands to LiveKit to connect — it encodes exactly what the
 * participant may do, so it can't be reused for another room.
 */
export async function createJoinToken(grant: TokenGrant): Promise<string> {
  const { apiKey, apiSecret } = config()
  const token = new AccessToken(apiKey, apiSecret, {
    identity: grant.identity,
    name: grant.name,
    // Auto-clean the participant's server state shortly after they leave.
    ttl: "2h",
  })
  token.addGrant({
    room: grant.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })
  return token.toJwt()
}

let roomClient: RoomServiceClient | null = null
function getRoomClient(): RoomServiceClient {
  const { apiKey, apiSecret, wsUrl } = config()
  if (!roomClient) {
    // ws://host:7880 → http://host:7880 for the server (room) API.
    roomClient = new RoomServiceClient(wsUrl.replace(/^ws/, "http"), apiKey, apiSecret)
  }
  return roomClient
}

/**
 * Explicitly create the room. LiveKit auto-creates on first join, so this is
 * optional — we use it to set an idle timeout so a room whose call is canceled
 * before anyone joins doesn't linger.
 */
export async function ensureRoom(roomName: string): Promise<void> {
  try {
    await getRoomClient().createRoom({
      name: roomName,
      emptyTimeout: 60, // seconds a room may sit empty before LiveKit reaps it
      maxParticipants: 2, // strictly 1:1
    })
  } catch {
    // Already exists / racing create — fine, join will still work.
  }
}

/** Tear the room down after a call ends so no orphaned media session remains. */
export async function deleteRoom(roomName: string): Promise<void> {
  try {
    await getRoomClient().deleteRoom(roomName)
  } catch {
    // Room already gone (LiveKit reaped it or never created) — nothing to do.
  }
}
