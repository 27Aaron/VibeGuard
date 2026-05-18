export type PublicTagCount = {
  tag: string
  count: number
}

export type PublicTagFilterItem = PublicTagCount & {
  active: boolean
}

export function buildPublicTagFilterModel(
  tags: PublicTagCount[],
  activeTag: string,
  limit = 12,
) {
  const normalizedActiveTag = activeTag.trim().toLowerCase()
  const sortedTags = [...tags]
    .filter((item) => item.tag.trim())
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))

  const visibleTags = sortedTags.slice(0, limit).map((item) => ({
    ...item,
    active: item.tag === normalizedActiveTag,
  }))
  const activeVisible = visibleTags.some((item) => item.active)

  if (normalizedActiveTag && !activeVisible) {
    const activeTagRecord =
      sortedTags.find((item) => item.tag === normalizedActiveTag) ?? {
        tag: normalizedActiveTag,
        count: 0,
      }

    visibleTags.push({
      ...activeTagRecord,
      active: true,
    })
  }

  const visibleTagSet = new Set(visibleTags.map((item) => item.tag))
  const overflowTags = sortedTags
    .filter((item) => !visibleTagSet.has(item.tag))
    .map((item) => ({
      ...item,
      active: false,
    }))

  return {
    visibleTags,
    overflowTags,
    hasTags: sortedTags.length > 0 || Boolean(normalizedActiveTag),
  }
}
