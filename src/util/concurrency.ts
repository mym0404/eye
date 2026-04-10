export const runWithConcurrency = async <InputValue, OutputValue>({
  items,
  concurrency,
  worker,
}: {
  items: InputValue[]
  concurrency: number
  worker: (item: InputValue, index: number) => Promise<OutputValue>
}) => {
  if (items.length === 0) {
    return [] as OutputValue[]
  }

  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<OutputValue>(items.length)
  let nextIndex = 0

  await Promise.all(
    Array.from({ length: safeConcurrency }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex
        nextIndex += 1
        results[currentIndex] = await worker(items[currentIndex], currentIndex)
      }
    }),
  )

  return results
}
