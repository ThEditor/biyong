import { describe, it, expect } from 'vitest';
import {
  classifySms,
  parseBankSms,
  parseAmountToMinor,
  cleanMerchant,
  dedupeParsed,
  smsHash,
} from '../sms-parser.js';

const NOW = new Date('2026-09-07T10:00:00Z');

/** 20+ realistic Indian bank/CC SMS corpus */
const CORPUS = {
  spends: [
    'Rs.1,250.00 debited from A/C XX4412 on 07-09 for UPI/CR/SWIGGY/okaxis REF 412875903412',
    'INR 450.00 spent on HDFC card xx8321 at AMAZON PAY INDIA on Sep 05',
    'Your Credit Card XX9987 used for Rs 2,15,000.00 at Apple Store BANGALORE',
    'Txn of Rs.99 done via UPI from A/C **7788 to ZOMATO LTD ref 034128759011',
    'Rs 3,499.00 paid using ICICI card X4523 at FLIPKANK INTERNET PVT LTD',
    'SBI: Rs 780 debited from a/c *3456 on 05-09-26 towards UPI to BLINKIT',
  ],
  credits: [
    'Rs 45,000.00 credited to A/C XX4412 from ACME CORP SALARY on 01-09',
    'INR 250.00 cashback credited to your HDFC card xx8321',
    'Rs.5,000 credited from JOHN DOE via UPI ref 412875903456',
  ],
  billPayments: [
    // the double-spend trap: card bill settlement looks like a credit
    'Payment of Rs 12,400.00 received towards your HDFC Bank Credit Card XX9987',
    'Rs 8,750.00 paid towards your Axis Bank Credit Card bill payment successful',
    'Credit card payment of Rs 3,200.00 successful for card ending 4523',
  ],
  noise: [
    'Your OTP for HDFC txn is 482913. Do not share with anyone.',
    'Congratulations! You have won a cashback offer. Login to claim.',
    'Your KYC is pending. Verify your CVV at the link. Never share OTP.',
    'Balance inquiry: available balance Rs 15,000 in A/C XX4412',
  ],
  retries: [
    'Rs.250.00 debited from A/C XX4412 for UPI to CHAI POINT',
    'Rs.250.00 debited from A/C XX4412 for UPI to CHAI POINT',
  ],
};

describe('classifySms', () => {
  it('classifies debit messages as spend', () => {
    for (const msg of CORPUS.spends) {
      const r = classifySms(msg);
      expect(r.kind).toBe('spend');
      expect(r.confidence).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('classifies credited money as credit', () => {
    for (const msg of CORPUS.credits) {
      expect(classifySms(msg).kind).toBe('credit');
    }
  });

  it('classifies card bill payments as bill_payment — NOT credit/spend', () => {
    for (const msg of CORPUS.billPayments) {
      const r = classifySms(msg);
      expect(r.kind).toBe('bill_payment');
    }
  });

  it('classifies OTP/marketing as noise', () => {
    for (const msg of CORPUS.noise) {
      expect(classifySms(msg).kind).toBe('noise');
    }
  });
});

describe('parseAmountToMinor', () => {
  it('handles Indian digit grouping', () => {
    expect(parseAmountToMinor('1,25,000.50')).toBe(12500050);
    expect(parseAmountToMinor('12,400')).toBe(1240000);
    expect(parseAmountToMinor('99')).toBe(9900);
    expect(parseAmountToMinor('garbage')).toBe(0);
  });
});

describe('cleanMerchant', () => {
  it('strips city names and terminal ids', () => {
    expect(cleanMerchant('APPLE STORE BANGALORE')).toBe('Apple Store');
    expect(cleanMerchant('SWIGGY MUMBAI')).toBe('Swiggy');
    expect(cleanMerchant('ZOMATO LTD TERM#9912')).toBe('Zomato Ltd');
  });
  it('returns null for empty input', () => {
    expect(cleanMerchant('  ')).toBeNull();
  });
});

describe('parseBankSms', () => {
  it('extracts amount in minor units from a UPI debit', () => {
    const r = parseBankSms(CORPUS.spends[0]!, NOW);
    expect(r.kind).toBe('spend');
    expect(r.amountMinor).toBe(125000);
  });

  it('extracts account last-4', () => {
    const r = parseBankSms(CORPUS.spends[0]!, NOW);
    expect(r.accountTail).toBe('4412');
    const cc = parseBankSms(CORPUS.spends[2]!, NOW);
    expect(cc.accountTail).toBe('9987');
  });

  it('extracts and cleans merchant from card spend', () => {
    const r = parseBankSms(CORPUS.spends[2]!, NOW);
    expect(r.merchant).toBe('Apple Store');
  });

  it('extracts UPI RRN reference for idempotency', () => {
    const r = parseBankSms(CORPUS.spends[0]!, NOW);
    expect(r.upiRef).toBe('412875903412');
  });

  it('resolves relative dates (Yesterday/Today)', () => {
    const r = parseBankSms('INR 100 debited from A/C XX1111 yesterday for UPI to TESTPAY', NOW);
    expect(r.date).toBe('2026-09-06');
  });

  it('resolves "12Sep"-style dates at import time', () => {
    const r = parseBankSms('INR 500 spent on card xx2222 at MOKA CAFE on 05Sep', NOW);
    expect(r.date).toBe('2026-09-05');
  });

  it('classifies bill payment SMS as bill_payment with amount intact', () => {
    const r = parseBankSms(CORPUS.billPayments[0]!, NOW);
    expect(r.kind).toBe('bill_payment');
    expect(r.amountMinor).toBe(1240000);
  });

  it('returns noise kind with zero amount for OTP SMS', () => {
    const r = parseBankSms(CORPUS.noise[0]!, NOW);
    expect(r.kind).toBe('noise');
    expect(r.amountMinor).toBe(0);
  });
});

describe('dedupeParsed', () => {
  const mk = (text: string, hash: string) => ({ parsed: parseBankSms(text, NOW), smsHash: hash });

  it('separates bill payments from importable spends', () => {
    const items = [
      mk(CORPUS.spends[1]!, 'h1'),
      mk(CORPUS.billPayments[0]!, 'h2'),
    ];
    const r = dedupeParsed(items);
    expect(r.importable).toHaveLength(1);
    expect(r.importable[0].kind).toBe('spend');
    expect(r.billPayments).toHaveLength(1);
    expect(r.billPayments[0].kind).toBe('bill_payment');
  });

  it('collapses retry duplicates (same amount + merchant, consecutive)', () => {
    const items = CORPUS.retries.map((t, i) => mk(t, `retry${i}`));
    const r = dedupeParsed(items);
    expect(r.dropped).toBe(1);
    expect(r.importable).toHaveLength(1);
  });

  it('is idempotent on identical hashes within a batch', () => {
    const items = [mk(CORPUS.spends[3]!, 'same-hash'), mk(CORPUS.spends[3]!, 'same-hash')];
    const r = dedupeParsed(items);
    expect(r.importable).toHaveLength(1);
  });

  it('drops noise and uncertain kinds entirely', () => {
    const items = CORPUS.noise.map((t, i) => mk(t, `n${i}`));
    const r = dedupeParsed(items);
    expect(r.importable).toHaveLength(0);
    expect(r.billPayments).toHaveLength(0);
  });

  it('produces a stable content hash', () => {
    expect(smsHash('abc', 'HDFBK', '123')).toBe(smsHash('abc', 'HDFBK', '123'));
    expect(smsHash('abc', 'HDFBK', '123')).not.toBe(smsHash('abd', 'HDFBK', '123'));
  });
});
