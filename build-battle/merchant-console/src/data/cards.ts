import { store } from "./store"

export const cardById = (id: string) =>
  store.cards.find((card) => card.id === id) ?? null

export const cardsByMerchant = (merchantId: string) =>
  store.cards.filter((card) => card.merchantId === merchantId)
