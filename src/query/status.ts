import { EyeDatabase } from "../storage/database.js"

const emptyIndexStatus = () => ({
  indexGeneration: 0,
  status: "idle",
  lastIndexStartedAt: undefined,
  lastIndexCompletedAt: undefined,
  lastError: undefined,
  fileCount: 0,
  symbolCount: 0,
  referenceCount: 0,
  dirtyCount: 0,
})

export const getIndexStatusSummary = async ({
  projectRoot,
  databasePath,
}: {
  projectRoot: string
  databasePath: string
}) => {
  const database = await EyeDatabase.openExistingReadOnly({
    databasePath,
    projectRoot,
  })

  if (!database) {
    return emptyIndexStatus()
  }

  try {
    return database.getIndexStatus()
  } finally {
    database.close()
  }
}
