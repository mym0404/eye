export const buildUser = (name: string) => ({
  id: `user-${name.toLowerCase()}`,
  name,
})
