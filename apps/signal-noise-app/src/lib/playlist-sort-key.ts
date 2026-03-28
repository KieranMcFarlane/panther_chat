export function formatPlaylistSortKey(sortKey: string[] | null | undefined) {
  const parts = Array.isArray(sortKey)
    ? sortKey.map((part) => String(part || '').trim()).filter(Boolean)
    : []
  if (parts.length === 0) {
    return 'priority_score DESC · entity_type ASC · entity_name ASC · entity_id ASC'
  }
  return parts.join(' · ')
}
