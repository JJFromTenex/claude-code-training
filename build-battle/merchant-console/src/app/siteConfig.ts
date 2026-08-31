export const siteConfig = {
  name: "Northwind Payments",
  url: "https://northwind.example",
  description: "Merchant console for support and operations.",
  baseLinks: {
    overview: "/overview",
    payments: "/payments",
    disputes: "/disputes",
    payouts: "/payouts",
    cards: "/cards",
  },
}

export type siteConfig = typeof siteConfig
