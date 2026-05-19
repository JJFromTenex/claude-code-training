# /fetch-data

Read the market data from `data/market-data.json` and produce a structured summary.

## What to Do

1. Read `data/market-data.json`
2. For each ticker, calculate:
   - Current price (most recent close)
   - 30-day change (first close vs. last close, as percentage)
   - Average daily volume
   - Highest high and lowest low in the period
   - Trend direction (rising, falling, or sideways — based on whether the last 5 closes are above or below the first 5)
3. Identify the **top mover** (largest % change) and **most volatile** (largest high-low range as % of average price)

## Output Format

Print a clean summary table, then a short narrative paragraph highlighting the key takeaways. Example:

```
MARKET SUMMARY — 2026-04-20 to 2026-05-19
Source: data/market-data.json

Ticker | Price   | 30d Change | Avg Volume | Trend
-------|---------|------------|------------|------
NOVA   | $170.20 | +18.4%     | 3.5M       | Rising
...

Top Mover: VEGA (+51.3%)
Most Volatile: DRIFT (daily range avg 3.2%)

Key takeaway: [1-2 sentence narrative]
```
