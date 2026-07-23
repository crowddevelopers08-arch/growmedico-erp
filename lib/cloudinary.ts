import { v2 as cloudinary } from "cloudinary"
import type { Prisma } from "./generated/prisma/client"

// Server-side only. The API secret must never reach the client, so this module
// must not be imported from a "use client" component.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

const FOLDER_ROOT = "gm-erm"

/**
 * Upload a base64 data URL to Cloudinary and return the hosted secure URL.
 *
 * - `null`/`undefined` pass straight through (nothing to store).
 * - Values that are already URLs (http/https, i.e. previously uploaded assets)
 *   pass through unchanged so re-saving a record doesn't re-upload.
 * - Only `data:` URLs are actually uploaded.
 *
 * Keeping this on the server means the raw base64 travels client -> server once
 * but is never persisted in Postgres — only the small Cloudinary URL is stored,
 * which is what fixes both the storage growth and the data-transfer quota.
 */
export async function uploadMedia(
  data: string | null | undefined,
  folder: string,
  opts: { image?: boolean } = {},
): Promise<string | null | undefined> {
  if (!data) return data
  if (!data.startsWith("data:")) return data

  const res = await cloudinary.uploader.upload(data, {
    folder: `${FOLDER_ROOT}/${folder}`,
    resource_type: "auto",
    // Cap dimensions and let Cloudinary auto-pick format/quality so stored
    // images stay small. Only applied to images — raw files/audio ignore it.
    ...(opts.image
      ? {
          transformation: [
            { width: 1200, height: 1200, crop: "limit", quality: "auto", fetch_format: "auto" },
          ],
        }
      : {}),
  })
  return res.secure_url
}

export interface RawAttachment {
  name: string
  type: string
  data: string
  size: number
}

/**
 * Upload each attachment's base64 payload, replacing `data` with a hosted URL.
 * Preserves name/type/size. Returns `undefined` for an empty/missing list so it
 * can be passed directly to a Prisma Json field.
 */
export async function uploadAttachments(
  attachments: RawAttachment[] | undefined | null,
  folder: string,
): Promise<Prisma.InputJsonValue | undefined> {
  if (!attachments || attachments.length === 0) return undefined
  const uploaded = await Promise.all(
    attachments.map(async (att) => ({
      ...att,
      data: (await uploadMedia(att.data, folder, { image: att.type?.startsWith("image/") })) ?? att.data,
    })),
  )
  // Plain JSON-safe objects; the cast satisfies Prisma's Json field input type.
  return uploaded as unknown as Prisma.InputJsonValue
}
