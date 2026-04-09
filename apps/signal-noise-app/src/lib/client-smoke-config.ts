import { ROLLOUT_PROOF_SET } from "@/lib/rollout-proof-set"

export type ClientSmokeConfigItem = {
  entity_uuid: string
  display_name: string
  aliases?: string[]
  purpose: string
  smoke_note: string
  account_priority?: number
}

export const PINNED_CLIENT_SMOKE_SET: ClientSmokeConfigItem[] = ROLLOUT_PROOF_SET.map((item) => ({
  entity_uuid: item.entity_uuid,
  display_name: item.display_name,
  aliases: item.aliases,
  purpose: item.purpose,
  smoke_note: item.smoke_note,
  account_priority: item.account_priority,
}))
