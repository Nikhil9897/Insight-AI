export interface CurrencyInfo {
  code: string;       // 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'NONE'
  symbol: string;     // '₹' | '$' | '€' | '£' | '¥' | ''
  name: string;
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  AUTO: { code: 'AUTO', symbol: '', name: 'Auto-Detect / Neutral' },
  NONE: { code: 'NONE', symbol: '', name: 'Plain Number (No Symbol)' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)' },
};

/**
 * Dynamically detects the appropriate currency info based on:
 * 1. Explicit user query request (e.g. "in USD", "revenue in euros")
 * 2. Column names (e.g. "Sales_USD", "Price_INR")
 * 3. Currency column values (e.g. column named "Currency" containing "USD", "INR")
 * 4. User preference / dataset setting
 */
export function detectCurrency(
  userQuery?: string,
  columnNames?: string[],
  datasetRows?: Record<string, any>[],
  preferredCurrencyCode?: string
): CurrencyInfo {
  // Respect explicit user preference if set (and not AUTO)
  if (preferredCurrencyCode && preferredCurrencyCode !== 'AUTO' && CURRENCIES[preferredCurrencyCode]) {
    return CURRENCIES[preferredCurrencyCode];
  }

  // 1. Check user query string explicitly
  if (userQuery) {
    const qLower = userQuery.toLowerCase();
    if (/\b(usd|\$|dollar|dollars)\b/i.test(qLower)) return CURRENCIES.USD;
    if (/\b(inr|₹|rupee|rupees)\b/i.test(qLower)) return CURRENCIES.INR;
    if (/\b(eur|€|euro|euros)\b/i.test(qLower)) return CURRENCIES.EUR;
    if (/\b(gbp|£|pound|pounds)\b/i.test(qLower)) return CURRENCIES.GBP;
    if (/\b(jpy|¥|yen)\b/i.test(qLower)) return CURRENCIES.JPY;
  }

  // 2. Check dataset Currency column values
  if (columnNames && datasetRows && datasetRows.length > 0) {
    const currCol = columnNames.find((c) => {
      const cl = c.toLowerCase();
      return cl === 'currency' || cl === 'curr' || cl === 'currency_code' || cl === 'currencycode';
    });

    if (currCol) {
      const val = String(datasetRows[0][currCol] || '').toUpperCase();
      if (val.includes('USD') || val.includes('$')) return CURRENCIES.USD;
      if (val.includes('INR') || val.includes('₹')) return CURRENCIES.INR;
      if (val.includes('EUR') || val.includes('€')) return CURRENCIES.EUR;
      if (val.includes('GBP') || val.includes('£')) return CURRENCIES.GBP;
      if (val.includes('JPY') || val.includes('¥')) return CURRENCIES.JPY;
    }
  }

  // 3. Check column name suffixes/hints (e.g. Sales_USD, Price_INR, Revenue_EUR)
  if (columnNames && columnNames.length > 0) {
    for (const col of columnNames) {
      const cl = col.toLowerCase();
      if (cl.includes('_usd') || cl.includes('(usd)') || cl.includes('$')) return CURRENCIES.USD;
      if (cl.includes('_inr') || cl.includes('(inr)') || cl.includes('₹')) return CURRENCIES.INR;
      if (cl.includes('_eur') || cl.includes('(eur)') || cl.includes('€')) return CURRENCIES.EUR;
      if (cl.includes('_gbp') || cl.includes('(gbp)') || cl.includes('£')) return CURRENCIES.GBP;
    }
  }

  // 4. Fallback to Neutral / Plain Number (No symbol assumed)
  return CURRENCIES.NONE;
}
