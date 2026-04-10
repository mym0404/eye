import type { EyeDatabase } from "../storage/database.js"

export const getIndexStatusSummary = ({
  database,
}: {
  database: EyeDatabase
}) => database.getIndexStatus()
