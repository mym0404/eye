const formatValue = (value: number) => value * 2

export const helper = (value: number) => formatValue(value) + 1

export class Worker {
  run = () => helper(3)
}
