/**
 * SMS transaction parsing — Indian banks and credit cards.
 *
 * Classification taxonomy (see skill: sms-txn-parser):
 *   SPEND        money leaves (debit card / CC swipe / UPI pay)
 *   CREDIT       money arrives (salary, refund, cashback, P2P receive)
 *   BILL_PAYMENT settlement of a credit-card liability — NOT a spend
 *   NOISE        OTPs, marketing, balance inquiries, login alerts
 *   UNCERTAIN    parser cannot confidently classify -> review queue
 *
 * All amounts are converted to integer minor units (paisa). No floats.
 * Compiled with noUncheckedIndexedAccess: regex groups use non-null
 * assertions only after a successful `.exec()` match.
 */

export type SmsKind = 'spend' | 'credit' | 'bill_payment' | 'noise' | 'uncertain';

export interface ParsedSms {
  kind: SmsKind;
  /** Integer minor units (paisa). 0 when kind is noise/uncertain. */
  amountMinor: number;
  /** Last-4 of the card/account the message refers to. */
  accountTail: string | null;
  /** Cleaned merchant/counterparty label, or null. */
  merchant: string | null;
  /** UPI/IMPS reference (RRN) for idempotency, when present. */
  upiRef: string | null;
  /** ISO date resolved from the message body (relative dates resolved). */
  date: string | null;
  /** 0-1 confidence that classification + extraction are correct. */
  confidence: number;
}

const AMOUNT_RE =
  /(?:rs\.?|inr|₹)\s*([\d][\d,]*(?:\.\d{1,2})?)\s*(?:(?:debited|spent|paid|credited|charged|received)|on|at|to|for|towards|using)/i;

const ACCOUNT_TAIL_RE =
  /(?:card|a\/c|acct|account|xx|xxxx|x{2,6})[\s]*(?:no\.?|number)?[\s:.\-*]*(?:ending\s+)?[xX*]{0,6}(\d{4})\b/i;

const UPI_REF_RE = /(?:upi|rrn|ref)\s*[/:\- ]\s*(?:ref(?:erence)?\s*(?:no\.?|#)?\s*[:\-]?\s*)?(\d{9,12})\b/i;

const CREDIT_WORDS = /\b(credited|received|refund|cashback|salary|deposited)\b/i;
const BILL_PAY_WORDS =
  /\b(payment\s+(?:of\s+)?(?:rs\.?|inr)?\s*[\d,]+(?:\.\d{1,2})?\s*(?:received|made|successful)|payment (?:received|made|successful)|towards (?:your )?card(?: payment)?|bill payment|auto[- ]?pay|repayment|emi (?:of|deducted)|paid towards)\b/i;
const DEBIT_WORDS = /\b(debited|spent|paid(?: using| via)?|card used|used for|purchased|txn (?:of|for))\b/i;
const NOISE_WORDS =
  /\b(otp|one time password|password is|login|blocked|fraud|kyc|w[o0]n|win|prize|giveaway|claim now|reward points|offer|cashback offer|congratulations|verify|cvv|do not share|never share|balance (?:inquiry|check)|available balance|account balance)\b/i;

/** Indian digit grouping: "1,25,000.50" -> 12500050 paisa */
export function parseAmountToMinor(raw: string): number {
  const cleaned = raw.replace(/,/g, '');
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

/** Strip gateway noise from merchant strings. */
export function cleanMerchant(raw: string): string | null {
  let m = raw.trim();
  if (!m) return null;
  // remove trailing city/timestamp fragments and terminal ids
  m = m.replace(
    /\b(?:mumbai|delhi|new delhi|bengaluru|bangalore|chennai|hyderabad|pune|kolkata|in)\b.*$/i,
    '',
  );
  m = m.replace(/\b\d{1,2}[-/]\d{1,2}(:\d{2})?\b/g, ''); // dates/times
  m = m.replace(/\b(term|txn|id|ref)\s*#?\d+$/i, '');
  m = m.replace(/[.\-#*]+$/, '');
  m = m.trim();
  if (m.length < 2) return null;
  // Title-case common patterns
  if (m === m.toUpperCase() && m.length > 3) {
    m = m
      .toLowerCase()
      .split(' ')
      .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
  }
  return m;
}

export function classifySms(text: string): { kind: SmsKind; confidence: number } {
  const t = text;

  // Bill payment must be checked FIRST: "payment received towards your
  // card" contains both "payment" and "received".
  if (BILL_PAY_WORDS.test(t) && /(card|credit card|cc)/i.test(t)) {
    return { kind: 'bill_payment', confidence: 0.9 };
  }

  // NOISE: OTPs/marketing/balance checks. A message that also carries a
  // real debit/credit verb AND an amount is still money (e.g. a debit SMS
  // appending "Avl Bal Rs X") — otherwise noise wins.
  const noiseHit = NOISE_WORDS.test(t);
  if (noiseHit) {
    const moneyVerb = DEBIT_WORDS.test(t) || CREDIT_WORDS.test(t);
    const hasAmount = /(?:rs\.?|inr|₹)\s*[\d][\d,]*/i.test(t);
    if (!moneyVerb || !hasAmount) return { kind: 'noise', confidence: 0.95 };
  }

  const hasAmount = AMOUNT_RE.test(t) || /(?:rs\.?|inr|₹)\s*[\d,]+/i.test(t);

  if (DEBIT_WORDS.test(t) && hasAmount) {
    return { kind: 'spend', confidence: 0.9 };
  }
  if (CREDIT_WORDS.test(t) && hasAmount) {
    return { kind: 'credit', confidence: 0.85 };
  }

  // Strong amount mention without a recognized verb
  if (hasAmount) return { kind: 'uncertain', confidence: 0.4 };
  return { kind: 'uncertain', confidence: 0.2 };
}

function resolveRelativeDate(text: string, now: Date): string | null {
  const t = text.toLowerCase();
  const fmt = (d: Date): string => d.toISOString().slice(0, 10);
  if (/\btoday\b/.test(t)) return fmt(now);
  if (/\byesterday\b/.test(t)) return fmt(new Date(now.getTime() - 86400000));
  // "on 12Sep" / "on 12 Sep" / "12-09"
  const dmy = /(?:on\s+)?(\d{1,2})[\s-]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i.exec(t);
  if (dmy) {
    const dayStr = dmy[1] ?? '';
    const monStr = (dmy[2] ?? '').toLowerCase();
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = months.indexOf(monStr);
    const day = Number.parseInt(dayStr, 10);
    if (month >= 0 && day >= 1 && day <= 31) {
      let year = now.getUTCFullYear();
      const candidate = new Date(Date.UTC(year, month, day));
      if (candidate.getTime() > now.getTime() + 86400000) year -= 1;
      return fmt(new Date(Date.UTC(year, month, day)));
    }
  }
  const numeric = /(\d{2})[-/](\d{2})(?:[-/](\d{4}))?/.exec(t);
  if (numeric) {
    const day = Number.parseInt(numeric[1] as string, 10);
    const month = Number.parseInt(numeric[2] as string, 10);
    const year = numeric[3] ? Number.parseInt(numeric[3], 10) : now.getUTCFullYear();
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return fmt(new Date(Date.UTC(year, month - 1, day)));
    }
  }
  return null;
}

/**
 * Parse a single bank/CC SMS into a ParsedSms.
 * `now` is injectable for deterministic tests.
 */
export function parseBankSms(text: string, now: Date = new Date()): ParsedSms {
  const { kind, confidence } = classifySms(text);
  if (kind === 'noise') {
    return { kind, amountMinor: 0, accountTail: null, merchant: null, upiRef: null, date: null, confidence };
  }

  let amountMinor = 0;
  const amt = AMOUNT_RE.exec(text) ?? /(?:rs\.?|inr|₹)\s*([\d][\d,]*(?:\.\d{1,2})?)/i.exec(text);
  if (amt?.[1]) amountMinor = parseAmountToMinor(amt[1]);

  const tail = ACCOUNT_TAIL_RE.exec(text);
  const accountTail = tail?.[1] ?? null;

  const upi = UPI_REF_RE.exec(text);
  const upiRef = upi?.[1] ?? null;

  let merchant: string | null = null;
  if (kind === 'spend') {
    const m =
      /\b(?:at|to|on)\s+([A-Za-z0-9][A-Za-z0-9 .&'/-]{1,40}?)(?=\s+(?:on|using|via|card|dated|\d{1,2}[-/])|$)/i.exec(
        text,
      );
    if (m?.[1]) merchant = cleanMerchant(m[1]);
  } else if (kind === 'credit') {
    const m = /\b(?:from|by)\s+([A-Za-z0-9][A-Za-z0-9 .&'/-]{1,40}?)(?=\s+(?:on|dated|\d{1,2}[-/])|$)/i.exec(text);
    if (m?.[1]) merchant = cleanMerchant(m[1]);
  }

  const date = resolveRelativeDate(text, now);

  return { kind, amountMinor, accountTail, merchant, upiRef, date, confidence };
}

/** Stable content hash for idempotent imports (FNV-1a 32-bit, hex). */
export function smsHash(text: string, senderId: string, timestamp: string): string {
  const input = `${senderId}|${timestamp}|${text.trim()}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export interface DedupeResult {
  /** Ready for import as transactions. */
  importable: ParsedSms[];
  /** Bill payments: settle liabilities, never import as spends. */
  billPayments: ParsedSms[];
  /** Retry/reversal duplicates removed. */
  dropped: number;
}

export interface HashedParsedSms {
  parsed: ParsedSms;
  smsHash: string;
}

/**
 * Collapse parsed SMS into an importable set:
 * - bill_payments separated (never become spends),
 * - same-amount + same-merchant consecutive retries keep only the last,
 * - UPI RRN / composite-hash idempotency is enforced by the caller via
 *   smsHash + UNIQUE constraint; this function dedupes within the batch.
 */
export function dedupeParsed(parsed: HashedParsedSms[]): DedupeResult {
  const billPayments: ParsedSms[] = [];
  const candidates: HashedParsedSms[] = [];
  const seenHash = new Set<string>();

  for (const item of parsed) {
    if (item.parsed.kind === 'bill_payment') {
      billPayments.push(item.parsed);
      continue;
    }
    if (item.parsed.kind === 'noise' || item.parsed.kind === 'uncertain') continue;
    // batch-level idempotency on hash
    if (seenHash.has(item.smsHash)) continue;
    seenHash.add(item.smsHash);
    candidates.push(item);
  }

  // Retry collapse: identical amount + merchant consecutive signature keeps
  // only the later entry (the earlier is the network-retry duplicate).
  const kept: HashedParsedSms[] = [];
  let dropped = 0;
  for (let i = 0; i < candidates.length; i++) {
    const cur = candidates[i];
    if (cur === undefined) continue;
    const next = candidates[i + 1];
    if (
      next &&
      next.parsed.kind === cur.parsed.kind &&
      next.parsed.amountMinor === cur.parsed.amountMinor &&
      next.parsed.merchant !== null &&
      cur.parsed.merchant !== null &&
      next.parsed.merchant.toLowerCase() === cur.parsed.merchant.toLowerCase()
    ) {
      dropped += 1;
      continue;
    }
    kept.push(cur);
  }

  return {
    importable: kept.map((k) => k.parsed),
    billPayments,
    dropped,
  };
}
