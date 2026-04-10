import { buildUser } from "./models/user.js"
import { helper } from "./utils/helper.js"

const user = buildUser("Ada")
const total = helper(4)

console.log(user.name, total)
