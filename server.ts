import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface StoredReferral {
  id: string;
  referrerCode: string;
  inviteeId: string;
  inviteeName: string;
  codeUsed: string;
  registeredAt: string;
  completedAt?: string;
  status: 'registered' | 'completed';
}

interface StoredAccount {
  userId: string;
  mobileNumber: string;
  username: string;
  passwordHash: string;
  referredBy: string | null;
  referralCode: string;
  createdAt: string;
}

interface StoredWithdrawal {
  id: string;
  txId: string;
  userId: string;
  username: string;
  userMobile?: string;
  amount: number;
  method: 'upi' | 'bank' | 'mobile';
  upiId?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  mobileNumber?: string;
  accountDetailSummary: string;
  status: 'Pending' | 'Success' | 'Rejected';
  createdAt: string;
  processedAt?: string;
}

interface StoredChatMessage {
  id: string;
  userId: string;
  username: string;
  mobileNumber: string;
  sender: 'user' | 'agent';
  text: string;
  imageUrl?: string;
  createdAt: string;
  readByAdmin: boolean;
  readByUser: boolean;
}

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL
  ? path.join('/tmp', 'aurex-vault-data')
  : path.resolve(process.cwd(), '.data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DATA_FILE = path.join(DATA_DIR, 'referrals.json');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const WALLETS_FILE = path.join(DATA_DIR, 'wallets.json');
const WITHDRAWALS_FILE = path.join(DATA_DIR, 'withdrawals.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

function ensureStore(): StoredReferral[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStore(records: StoredReferral[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

function ensureAccounts(): StoredAccount[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      fs.writeFileSync(ACCOUNTS_FILE, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: StoredAccount[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

function ensureWallets(): Record<string, unknown> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(WALLETS_FILE)) {
      fs.writeFileSync(WALLETS_FILE, '{}', 'utf-8');
      return {};
    }
    const raw = fs.readFileSync(WALLETS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function saveWallets(wallets: Record<string, unknown>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

function ensureWithdrawals(): StoredWithdrawal[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(WITHDRAWALS_FILE)) {
      fs.writeFileSync(WITHDRAWALS_FILE, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(WITHDRAWALS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWithdrawals(records: StoredWithdrawal[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(WITHDRAWALS_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

function ensureMessages(): StoredChatMessage[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(MESSAGES_FILE)) {
      fs.writeFileSync(MESSAGES_FILE, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(MESSAGES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(records: StoredChatMessage[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

const ALLOWED_IMAGE_MIMES: Record<string, string> = {
  png: 'png',
  jpeg: 'jpg',
  jpg: 'jpg',
  webp: 'webp',
  gif: 'gif',
};

function saveChatImageDataUrl(rawDataUrl: unknown): string | undefined {
  if (typeof rawDataUrl !== 'string' || !rawDataUrl) return undefined;
  const match = rawDataUrl.match(
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\r\n]+)$/i
  );
  if (!match) return undefined;
  const rawSubtype = match[1].toLowerCase();
  const ext = ALLOWED_IMAGE_MIMES[rawSubtype];
  if (!ext) return undefined;

  const base64Body = match[2].replace(/\s+/g, '');
  const buffer = Buffer.from(base64Body, 'base64');
  // Limit decoded image file to 4 MB
  if (buffer.length === 0 || buffer.length > 4 * 1024 * 1024) {
    return undefined;
  }

  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const filename = `img-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    return `/api/uploads/${filename}`;
  } catch {
    return undefined;
  }
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuf, derived);
}

function generateNewUserId(existingIds: Set<string>): string {
  let candidate = String(Math.floor(100000 + Math.random() * 899999));
  while (existingIds.has(candidate) || candidate === '415061') {
    candidate = String(Math.floor(100000 + Math.random() * 899999));
  }
  return candidate;
}

const ADMIN_MOBILE_NUMBER = '7285009425';
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'raja890';

function normalizeMobile(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function isAdminRequest(req: express.Request): boolean {
  return normalizeMobile(req.header('x-admin-mobile')) === ADMIN_MOBILE_NUMBER;
}

function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function ensureAdminAccountSeeded(): StoredAccount[] {
  const accounts = ensureAccounts();
  if (accounts.some((a) => normalizeMobile(a.mobileNumber) === ADMIN_MOBILE_NUMBER)) {
    return accounts;
  }

  const wallets = ensureWallets();
  let matchedUserId: string | null = null;
  let matchedWallet: Record<string, unknown> | undefined;
  for (const [wId, rawWallet] of Object.entries(wallets)) {
    if (!rawWallet || typeof rawWallet !== 'object') continue;
    const w = rawWallet as Record<string, unknown>;
    const authAcc =
      typeof w.authAccount === 'object' && w.authAccount
        ? (w.authAccount as Record<string, unknown>)
        : undefined;
    const profile =
      typeof w.profile === 'object' && w.profile
        ? (w.profile as Record<string, unknown>)
        : undefined;
    const wMobile = normalizeMobile(authAcc?.mobileNumber || profile?.mobileNumber);
    if (wMobile === ADMIN_MOBILE_NUMBER) {
      matchedUserId = wId;
      matchedWallet = w;
      break;
    }
  }

  const existingIds = new Set([
    ...accounts.map((a) => a.userId),
    ...Object.keys(wallets),
  ]);
  const userId = matchedUserId || generateNewUserId(existingIds);
  const authAcc =
    matchedWallet && typeof matchedWallet.authAccount === 'object' && matchedWallet.authAccount
      ? (matchedWallet.authAccount as Record<string, unknown>)
      : undefined;
  const profile =
    matchedWallet && typeof matchedWallet.profile === 'object' && matchedWallet.profile
      ? (matchedWallet.profile as Record<string, unknown>)
      : undefined;
  const username =
    String(authAcc?.username || profile?.username || 'User_25').trim() ||
    'User_25';
  const createdAt =
    typeof authAcc?.createdAt === 'string' && authAcc.createdAt
      ? authAcc.createdAt
      : nowTimestamp();

  const adminAccount: StoredAccount = {
    userId,
    mobileNumber: ADMIN_MOBILE_NUMBER,
    username,
    passwordHash: hashPassword(ADMIN_DEFAULT_PASSWORD),
    referredBy:
      typeof authAcc?.referredBy === 'string' ? authAcc.referredBy : null,
    referralCode: String(authAcc?.referralCode || `AUREX-${userId}`),
    createdAt,
  };

  accounts.unshift(adminAccount);
  saveAccounts(accounts);
  return accounts;
}

export function createApp(): express.Express {
  ensureAdminAccountSeeded();
  const app = express();

  app.use(express.json({ limit: '6mb' }));

  // Serve locally stored chat photo uploads safely
  app.get('/api/uploads/:filename', (req, res) => {
    const filename = String(req.params.filename || '').trim();
    if (!/^img-[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|gif)$/.test(filename)) {
      res.status(400).json({ error: 'INVALID_FILENAME' });
      return;
    }
    const fullPath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(fullPath);
  });

  // Register account with Mobile Number + Username + Password + Confirm Password + Referral Code
  app.post('/api/auth/register', (req, res) => {
    const mobileNumber = normalizeMobile(req.body?.mobileNumber);
    const username = String(req.body?.username || '').trim().slice(0, 64);
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirmPassword || '');
    const rawRef = String(req.body?.referralCode || '').trim().toUpperCase();

    if (mobileNumber.length !== 10) {
      res.status(400).json({ error: 'INVALID_MOBILE' });
      return;
    }
    if (username.length < 2) {
      res.status(400).json({ error: 'INVALID_USERNAME' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'INVALID_PASSWORD' });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'PASSWORD_MISMATCH' });
      return;
    }

    const accounts = ensureAdminAccountSeeded();
    if (accounts.some((a) => normalizeMobile(a.mobileNumber) === mobileNumber)) {
      res.status(409).json({ error: 'MOBILE_EXISTS' });
      return;
    }

    const wallets = ensureWallets();
    let legacyUserId: string | null = null;
    let existingWallet: Record<string, unknown> | null = null;
    for (const [wId, rawWallet] of Object.entries(wallets)) {
      if (!rawWallet || typeof rawWallet !== 'object') continue;
      const w = rawWallet as Record<string, unknown>;
      const authAcc =
        typeof w.authAccount === 'object' && w.authAccount
          ? (w.authAccount as Record<string, unknown>)
          : undefined;
      const profile =
        typeof w.profile === 'object' && w.profile
          ? (w.profile as Record<string, unknown>)
          : undefined;
      const wMobile = normalizeMobile(authAcc?.mobileNumber || profile?.mobileNumber);
      if (wMobile === mobileNumber) {
        legacyUserId = wId;
        existingWallet = w;
        break;
      }
    }

    const existingIds = new Set([
      ...accounts.map((a) => a.userId),
      ...Object.keys(wallets),
    ]);
    const userId = legacyUserId || generateNewUserId(existingIds);
    const ownReferralCode = `AUREX-${userId}`;

    if (rawRef && rawRef === ownReferralCode) {
      res.status(400).json({ error: 'SELF_REFERRAL' });
      return;
    }

    const referredBy = rawRef ? rawRef.slice(0, 32) : null;
    const now = nowTimestamp();
    const newAccount: StoredAccount = {
      userId,
      mobileNumber,
      username,
      passwordHash: hashPassword(password),
      referredBy,
      referralCode: ownReferralCode,
      createdAt:
        typeof existingWallet?.authAccount === 'object' &&
        existingWallet.authAccount &&
        typeof (existingWallet.authAccount as Record<string, unknown>).createdAt === 'string'
          ? String((existingWallet.authAccount as Record<string, unknown>).createdAt)
          : now,
    };

    accounts.unshift(newAccount);
    saveAccounts(accounts);

    // Record genuine referral registration if referralCode was provided
    if (referredBy) {
      const referrals = ensureStore();
      const existsRef = referrals.some(
        (r) => r.referrerCode === referredBy && r.inviteeId === userId
      );
      if (!existsRef) {
        referrals.unshift({
          id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          referrerCode: referredBy,
          inviteeId: userId,
          inviteeName: username,
          codeUsed: referredBy,
          registeredAt: now,
          status: 'registered',
        });
        saveStore(referrals);
      }
    }

    res.json({
      ok: true,
      account: {
        userId: newAccount.userId,
        mobileNumber: newAccount.mobileNumber,
        username: newAccount.username,
        referredBy: newAccount.referredBy,
        referralCode: newAccount.referralCode,
        createdAt: newAccount.createdAt,
      },
      existingWallet,
    });
  });

  // Login with Mobile Number + Password
  app.post('/api/auth/login', (req, res) => {
    const mobileNumber = normalizeMobile(req.body?.mobileNumber);
    const password = String(req.body?.password || '');

    if (mobileNumber.length !== 10 || password.length < 6) {
      res.status(400).json({ error: 'INVALID_CREDENTIALS' });
      return;
    }

    const accounts = ensureAdminAccountSeeded();
    const found = accounts.find((a) => normalizeMobile(a.mobileNumber) === mobileNumber);
    if (!found) {
      res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        ...(IS_VERCEL ? { ephemeralMissing: true } : {}),
      });
      return;
    }
    if (!verifyPassword(password, found.passwordHash)) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS' });
      return;
    }

    res.json({
      ok: true,
      account: {
        userId: found.userId,
        mobileNumber: found.mobileNumber,
        username: found.username,
        referredBy: found.referredBy,
        referralCode: found.referralCode,
        createdAt: found.createdAt,
      },
    });
  });

  // Get persisted wallet state for a userId
  app.get('/api/wallet/:userId', (req, res) => {
    const userId = String(req.params.userId || '').trim();
    if (!userId) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }
    const wallets = ensureWallets();
    res.json({ wallet: wallets[userId] ?? null });
  });

  // Persist wallet state for a userId
  app.put('/api/wallet/:userId', (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const wallet = req.body?.wallet;
    if (!userId || !wallet || typeof wallet !== 'object') {
      res.status(400).json({ error: 'Invalid wallet payload' });
      return;
    }
    const wallets = ensureWallets();
    wallets[userId] = wallet;
    saveWallets(wallets);
    res.json({ ok: true });
  });

  // Get all referrals attributed to a referrer code (e.g. AUREX-415061)
  app.get('/api/referrals/:referrerCode', (req, res) => {
    const code = String(req.params.referrerCode || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ error: 'Invalid referrer code' });
      return;
    }
    const all = ensureStore();
    const list = all.filter((r) => r.referrerCode === code);
    res.json({ referrals: list });
  });

  // Record a genuine registration from a shared referral link (?ref=...)
  app.post('/api/referrals/register', (req, res) => {
    const referrerCode = String(req.body?.referrerCode || '').trim().toUpperCase();
    const inviteeId = String(req.body?.inviteeId || '').trim();
    const inviteeName = String(req.body?.inviteeName || '').trim() || `User_${inviteeId.slice(-2)}`;

    if (!referrerCode || !inviteeId) {
      res.status(400).json({ error: 'referrerCode and inviteeId are required' });
      return;
    }
    if (referrerCode === `AUREX-${inviteeId}`) {
      res.status(400).json({ error: 'Self-referral is not allowed' });
      return;
    }

    const all = ensureStore();
    const existing = all.find(
      (r) => r.referrerCode === referrerCode && r.inviteeId === inviteeId
    );
    if (existing) {
      res.json({ ok: true, referral: existing });
      return;
    }

    const record: StoredReferral = {
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      referrerCode,
      inviteeId,
      inviteeName,
      codeUsed: referrerCode,
      registeredAt: nowTimestamp(),
      status: 'registered',
    };

    all.unshift(record);
    saveStore(all);
    res.json({ ok: true, referral: record });
  });

  // Mark a registered referral as order-completed once they finish an approved order
  app.post('/api/referrals/complete', (req, res) => {
    const inviteeId = String(req.body?.inviteeId || '').trim();
    const referrerCode = req.body?.referrerCode
      ? String(req.body.referrerCode).trim().toUpperCase()
      : null;

    if (!inviteeId) {
      res.status(400).json({ error: 'inviteeId is required' });
      return;
    }

    const all = ensureStore();
    let updated = false;
    const now = nowTimestamp();

    const next = all.map((r) => {
      const matchCode = referrerCode ? r.referrerCode === referrerCode : true;
      if (matchCode && r.inviteeId === inviteeId && r.status === 'registered') {
        updated = true;
        return {
          ...r,
          status: 'completed' as const,
          completedAt: now,
        };
      }
      return r;
    });

    if (updated) {
      saveStore(next);
    }

    res.json({ ok: true, updated });
  });

  // List withdrawal requests (all for Admin +91 7285009425; scoped to userId otherwise)
  app.get('/api/withdrawals', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const all = ensureWithdrawals();
    if (isAdminRequest(req)) {
      res.json({ withdrawals: all });
      return;
    }
    const queryUserId = String(req.query?.userId || '').trim();
    const filtered = queryUserId ? all.filter((w) => w.userId === queryUserId) : [];
    res.json({ withdrawals: filtered });
  });

  // Record a new withdrawal request (minimum ₹1,500)
  app.post('/api/withdrawals', (req, res) => {
    const amount = Number(req.body?.amount);
    const method = req.body?.method;
    const userId = String(req.body?.userId || '').trim();
    const username = String(req.body?.username || '').trim() || 'User';
    const userMobile = req.body?.userMobile ? String(req.body.userMobile).replace(/\D/g, '') : undefined;
    const txId = String(req.body?.txId || '').trim() || `tx-${Date.now()}`;

    if (!Number.isFinite(amount) || amount < 1500) {
      res.status(400).json({ error: 'MIN_WITHDRAW_1500' });
      return;
    }
    if (method !== 'upi' && method !== 'bank' && method !== 'mobile') {
      res.status(400).json({ error: 'INVALID_METHOD' });
      return;
    }
    if (!userId) {
      res.status(400).json({ error: 'INVALID_USER' });
      return;
    }

    const upiId = req.body?.upiId ? String(req.body.upiId).trim().slice(0, 100) : undefined;
    const bankName = req.body?.bankName ? String(req.body.bankName).trim().slice(0, 100) : undefined;
    const accountNumber = req.body?.accountNumber ? String(req.body.accountNumber).trim().slice(0, 32) : undefined;
    const ifscCode = req.body?.ifscCode ? String(req.body.ifscCode).trim().toUpperCase().slice(0, 20) : undefined;
    const mobileNumber = req.body?.mobileNumber ? String(req.body.mobileNumber).replace(/\D/g, '') : undefined;

    let accountDetailSummary = '';
    if (method === 'upi') {
      if (!upiId || !upiId.includes('@')) {
        res.status(400).json({ error: 'INVALID_UPI' });
        return;
      }
      accountDetailSummary = `UPI ID: ${upiId}`;
    } else if (method === 'bank') {
      if (!bankName || !accountNumber || accountNumber.length < 6) {
        res.status(400).json({ error: 'INVALID_BANK' });
        return;
      }
      accountDetailSummary = ifscCode
        ? `${bankName} · A/C ${accountNumber} · IFSC ${ifscCode}`
        : `${bankName} · A/C ${accountNumber}`;
    } else {
      if (!mobileNumber || mobileNumber.length !== 10) {
        res.status(400).json({ error: 'INVALID_MOBILE' });
        return;
      }
      accountDetailSummary = `Mobile: +91 ${mobileNumber}`;
    }

    const status: 'Pending' | 'Success' | 'Rejected' =
      req.body?.status === 'Success' ? 'Success' : 'Pending';

    const record: StoredWithdrawal = {
      id: String(req.body?.id || `wdr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
      txId,
      userId,
      username,
      userMobile,
      amount: Math.round((amount + Number.EPSILON) * 100) / 100,
      method,
      upiId,
      bankName,
      accountNumber,
      ifscCode,
      mobileNumber,
      accountDetailSummary,
      status,
      createdAt: String(req.body?.createdAt || nowTimestamp()),
    };

    const all = ensureWithdrawals();
    all.unshift(record);
    saveWithdrawals(all);
    res.json({ ok: true, withdrawal: record });
  });

  // Admin approve or reject a withdrawal request (locked to +91 7285009425)
  app.post('/api/withdrawals/:id/status', (req, res) => {
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: 'ADMIN_ONLY' });
      return;
    }
    const id = String(req.params.id || '').trim();
    const nextStatus = req.body?.status;
    if (!id || (nextStatus !== 'Success' && nextStatus !== 'Rejected')) {
      res.status(400).json({ error: 'INVALID_STATUS' });
      return;
    }

    const all = ensureWithdrawals();
    const targetIndex = all.findIndex((w) => w.id === id);
    if (targetIndex === -1) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const target = all[targetIndex];
    if (target.status !== 'Pending') {
      res.json({ ok: true, withdrawal: target });
      return;
    }

    const now = nowTimestamp();
    const updated: StoredWithdrawal = {
      ...target,
      status: nextStatus,
      processedAt: now,
    };
    all[targetIndex] = updated;
    saveWithdrawals(all);

    // Sync target user's stored wallet if present on server
    const wallets = ensureWallets();
    const targetWallet = wallets[target.userId] as Record<string, unknown> | undefined;
    if (targetWallet && typeof targetWallet === 'object') {
      const txs = Array.isArray(targetWallet.transactions)
        ? (targetWallet.transactions as Array<Record<string, unknown>>)
        : [];
      const notifs = Array.isArray(targetWallet.notifications)
        ? (targetWallet.notifications as Array<Record<string, unknown>>)
        : [];

      const updatedTxs = txs.map((tx) =>
        tx.id === target.txId ? { ...tx, status: nextStatus } : tx
      );

      let nextBalance = Number(targetWallet.walletBalance ?? 0);
      let nextTotalWithdrawal = Number(targetWallet.totalWithdrawal ?? 0);
      if (nextStatus === 'Rejected') {
        nextBalance = Math.round((nextBalance + target.amount + Number.EPSILON) * 100) / 100;
        nextTotalWithdrawal = Math.max(
          0,
          Math.round((nextTotalWithdrawal - target.amount + Number.EPSILON) * 100) / 100
        );
      }

      const notif = {
        id: `notif-wdr-${Date.now()}`,
        title: nextStatus === 'Success' ? 'Withdrawal Approved & Paid' : 'Withdrawal Rejected · Refunded',
        titleZh: nextStatus === 'Success' ? '提现已审核通过并打款' : '提现已拒绝 · 余额已退回',
        message:
          nextStatus === 'Success'
            ? `₹${target.amount} withdrawal to ${target.accountDetailSummary} was approved.`
            : `₹${target.amount} withdrawal to ${target.accountDetailSummary} was rejected and refunded to your wallet.`,
        messageZh:
          nextStatus === 'Success'
            ? `向 ${target.accountDetailSummary} 提现 ₹${target.amount} 已通过并打款。`
            : `向 ${target.accountDetailSummary} 提现 ₹${target.amount} 已被拒绝，金额已退回您的钱包。`,
        timestamp: now,
        read: false,
        kind: 'withdrawal',
      };

      wallets[target.userId] = {
        ...targetWallet,
        walletBalance: nextBalance,
        totalWithdrawal: nextTotalWithdrawal,
        transactions: updatedTxs,
        notifications: [notif, ...notifs],
      };
      saveWallets(wallets);
    }

    res.json({ ok: true, withdrawal: updated });
  });

  // Admin: list all registered user profiles with wallet summary (locked to +91 7285009425)
  app.get('/api/admin/users', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: 'ADMIN_ONLY' });
      return;
    }
    const accounts = ensureAdminAccountSeeded();
    const wallets = ensureWallets();

    const byUserId = new Map<
      string,
      {
        userId: string;
        mobileNumber: string;
        username: string;
        hasPassword: boolean;
        referralCode: string;
        referredBy: string | null;
        createdAt: string;
        walletBalance: number;
        totalPaid: number;
        totalWithdrawal: number;
        linkedAppName?: string;
        upiId?: string;
      }
    >();

    for (const acc of accounts) {
      const w = wallets[acc.userId] as Record<string, unknown> | undefined;
      const profile =
        w && typeof w.profile === 'object' && w.profile
          ? (w.profile as Record<string, unknown>)
          : undefined;
      const linkedApp =
        w && typeof w.linkedPaymentApp === 'object' && w.linkedPaymentApp
          ? (w.linkedPaymentApp as Record<string, unknown>)
          : undefined;

      byUserId.set(acc.userId, {
        userId: acc.userId,
        mobileNumber: acc.mobileNumber,
        username: acc.username,
        hasPassword: Boolean(acc.passwordHash),
        referralCode: acc.referralCode,
        referredBy: acc.referredBy,
        createdAt: acc.createdAt,
        walletBalance: w ? Number(w.walletBalance ?? 0) : 0,
        totalPaid: w ? Number(w.totalPaid ?? 0) : 0,
        totalWithdrawal: w ? Number(w.totalWithdrawal ?? 0) : 0,
        linkedAppName:
          linkedApp && typeof linkedApp.appName === 'string'
            ? linkedApp.appName
            : undefined,
        upiId:
          profile && typeof profile.upiId === 'string'
            ? profile.upiId
            : undefined,
      });
    }

    // Also include any active users persisted in wallets.json (e.g. from prior session)
    for (const [walletUserId, rawWallet] of Object.entries(wallets)) {
      if (byUserId.has(walletUserId)) continue;
      if (!rawWallet || typeof rawWallet !== 'object') continue;
      const w = rawWallet as Record<string, unknown>;
      const authAcc =
        typeof w.authAccount === 'object' && w.authAccount
          ? (w.authAccount as Record<string, unknown>)
          : undefined;
      const profile =
        typeof w.profile === 'object' && w.profile
          ? (w.profile as Record<string, unknown>)
          : undefined;
      const linkedApp =
        typeof w.linkedPaymentApp === 'object' && w.linkedPaymentApp
          ? (w.linkedPaymentApp as Record<string, unknown>)
          : undefined;

      const mobileNumber = String(
        authAcc?.mobileNumber ||
          profile?.mobileNumber ||
          linkedApp?.mobileNumber ||
          ''
      ).replace(/\D/g, '');
      const username = String(
        authAcc?.username || profile?.username || ''
      ).trim();

      if (!username && !mobileNumber) continue;

      byUserId.set(walletUserId, {
        userId: walletUserId,
        mobileNumber: mobileNumber || '—',
        username: username || `User_${walletUserId.slice(-2)}`,
        hasPassword: false,
        referralCode: String(
          authAcc?.referralCode || `AUREX-${walletUserId}`
        ),
        referredBy:
          typeof authAcc?.referredBy === 'string'
            ? authAcc.referredBy
            : typeof w.referredBy === 'string'
            ? w.referredBy
            : null,
        createdAt: String(
          authAcc?.createdAt ||
            linkedApp?.linkedAt ||
            nowTimestamp()
        ),
        walletBalance: Number(w.walletBalance ?? 0),
        totalPaid: Number(w.totalPaid ?? 0),
        totalWithdrawal: Number(w.totalWithdrawal ?? 0),
        linkedAppName:
          linkedApp && typeof linkedApp.appName === 'string'
            ? linkedApp.appName
            : undefined,
        upiId:
          profile && typeof profile.upiId === 'string'
            ? profile.upiId
            : undefined,
      });
    }

    res.json({ users: Array.from(byUserId.values()) });
  });

  // Admin: reset a user's password (locked to +91 7285009425)
  app.post('/api/admin/users/:userId/reset-password', (req, res) => {
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: 'ADMIN_ONLY' });
      return;
    }
    const userId = String(req.params.userId || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (!userId || newPassword.length < 6) {
      res.status(400).json({ error: 'INVALID_PASSWORD' });
      return;
    }

    const accounts = ensureAccounts();
    const idx = accounts.findIndex((a) => a.userId === userId);
    if (idx === -1) {
      const wallets = ensureWallets();
      const w = wallets[userId] as Record<string, unknown> | undefined;
      if (!w || typeof w !== 'object') {
        res.status(404).json({ error: 'USER_NOT_FOUND' });
        return;
      }
      const authAcc =
        typeof w.authAccount === 'object' && w.authAccount
          ? (w.authAccount as Record<string, unknown>)
          : undefined;
      const profile =
        typeof w.profile === 'object' && w.profile
          ? (w.profile as Record<string, unknown>)
          : undefined;
      const mobileNumber = String(
        authAcc?.mobileNumber || profile?.mobileNumber || ''
      ).replace(/\D/g, '');
      const username = String(
        authAcc?.username || profile?.username || `User_${userId.slice(-2)}`
      ).trim();

      accounts.unshift({
        userId,
        mobileNumber,
        username,
        passwordHash: hashPassword(newPassword),
        referredBy:
          typeof authAcc?.referredBy === 'string' ? authAcc.referredBy : null,
        referralCode: String(authAcc?.referralCode || `AUREX-${userId}`),
        createdAt: String(authAcc?.createdAt || nowTimestamp()),
      });
      saveAccounts(accounts);
      res.json({ ok: true });
      return;
    }

    accounts[idx] = {
      ...accounts[idx],
      passwordHash: hashPassword(newPassword),
    };
    saveAccounts(accounts);
    res.json({ ok: true });
  });

  // Get chat messages for a specific user
  app.get('/api/messages/:userId', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const userId = String(req.params.userId || '').trim();
    if (!userId) {
      res.status(400).json({ error: 'INVALID_USER' });
      return;
    }
    const markRead = req.query?.markRead === '1';
    const all = ensureMessages();
    let changed = false;
    const userMsgs = all
      .map((m) => {
        if (markRead && m.userId === userId && m.sender === 'agent' && !m.readByUser) {
          changed = true;
          return { ...m, readByUser: true };
        }
        return m;
      })
      .filter((m) => m.userId === userId);

    if (changed) {
      const updatedAll = all.map((m) =>
        m.userId === userId && m.sender === 'agent' && !m.readByUser
          ? { ...m, readByUser: true }
          : m
      );
      saveMessages(updatedAll);
    }

    res.json({ messages: userMsgs });
  });

  // User sends a support message (text and/or photo)
  app.post('/api/messages', (req, res) => {
    const userId = String(req.body?.userId || '').trim();
    const username = String(req.body?.username || '').trim().slice(0, 64) || 'User';
    const mobileNumber = normalizeMobile(req.body?.mobileNumber) || '—';
    const text = String(req.body?.text || '').trim().slice(0, 1000);
    const hasImageInput = typeof req.body?.imageData === 'string' && req.body.imageData.length > 0;
    const imageUrl = hasImageInput ? saveChatImageDataUrl(req.body.imageData) : undefined;

    if (hasImageInput && !imageUrl) {
      res.status(400).json({ error: 'INVALID_IMAGE' });
      return;
    }
    if (!userId || (!text && !imageUrl)) {
      res.status(400).json({ error: 'INVALID_MESSAGE' });
      return;
    }

    const msg: StoredChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      username,
      mobileNumber,
      sender: 'user',
      text,
      ...(imageUrl ? { imageUrl } : {}),
      createdAt: nowTimestamp(),
      readByAdmin: false,
      readByUser: true,
    };

    const all = ensureMessages();
    all.push(msg);
    saveMessages(all);
    res.json({ ok: true, message: msg });
  });

  // Admin: WhatsApp-style inbox of all users & messages (locked to +91 7285009425)
  app.get('/api/admin/messages', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: 'ADMIN_ONLY' });
      return;
    }

    const allMessages = ensureMessages();
    const accounts = ensureAdminAccountSeeded();
    const wallets = ensureWallets();

    const threadsMap = new Map<
      string,
      {
        userId: string;
        username: string;
        mobileNumber: string;
        referralCode?: string;
        unreadCount: number;
        lastMessage?: string;
        lastTime?: string;
        messages: StoredChatMessage[];
      }
    >();

    // Seed every registered / wallet user profile so audience profiles appear like WhatsApp contacts
    for (const acc of accounts) {
      threadsMap.set(acc.userId, {
        userId: acc.userId,
        username: acc.username,
        mobileNumber: acc.mobileNumber,
        referralCode: acc.referralCode,
        unreadCount: 0,
        messages: [],
      });
    }

    for (const [walletUserId, rawWallet] of Object.entries(wallets)) {
      if (threadsMap.has(walletUserId)) continue;
      if (!rawWallet || typeof rawWallet !== 'object') continue;
      const w = rawWallet as Record<string, unknown>;
      const authAcc =
        typeof w.authAccount === 'object' && w.authAccount
          ? (w.authAccount as Record<string, unknown>)
          : undefined;
      const profile =
        typeof w.profile === 'object' && w.profile
          ? (w.profile as Record<string, unknown>)
          : undefined;
      const linkedApp =
        typeof w.linkedPaymentApp === 'object' && w.linkedPaymentApp
          ? (w.linkedPaymentApp as Record<string, unknown>)
          : undefined;

      const mobileNumber = normalizeMobile(
        authAcc?.mobileNumber || profile?.mobileNumber || linkedApp?.mobileNumber
      );
      const username = String(authAcc?.username || profile?.username || '').trim();
      if (!username && !mobileNumber) continue;

      threadsMap.set(walletUserId, {
        userId: walletUserId,
        username: username || `User_${walletUserId.slice(-2)}`,
        mobileNumber: mobileNumber || '—',
        referralCode: String(authAcc?.referralCode || `AUREX-${walletUserId}`),
        unreadCount: 0,
        messages: [],
      });
    }

    for (const msg of allMessages) {
      let thread = threadsMap.get(msg.userId);
      if (!thread) {
        thread = {
          userId: msg.userId,
          username: msg.username || `User_${msg.userId.slice(-2)}`,
          mobileNumber: msg.mobileNumber || '—',
          referralCode: `AUREX-${msg.userId}`,
          unreadCount: 0,
          messages: [],
        };
        threadsMap.set(msg.userId, thread);
      }
      if (msg.username && (!thread.username || thread.username.startsWith('User_'))) {
        thread.username = msg.username;
      }
      if (msg.mobileNumber && msg.mobileNumber !== '—' && (!thread.mobileNumber || thread.mobileNumber === '—')) {
        thread.mobileNumber = msg.mobileNumber;
      }
      thread.messages.push(msg);
      thread.lastMessage = msg.text || (msg.imageUrl ? '📷 Photo' : '');
      thread.lastTime = msg.createdAt;
      if (msg.sender === 'user' && !msg.readByAdmin) {
        thread.unreadCount += 1;
      }
    }

    // Sort: threads with latest messages at top (newest first), then contacts without messages
    const threads = Array.from(threadsMap.values()).sort((a, b) => {
      if (a.lastTime && b.lastTime) {
        return b.lastTime.localeCompare(a.lastTime);
      }
      if (a.lastTime) return -1;
      if (b.lastTime) return 1;
      return a.username.localeCompare(b.username);
    });

    res.json({ threads });
  });

  // Admin: reply to a user's message thread (text and/or photo, locked to +91 7285009425)
  app.post('/api/admin/messages/:userId/reply', (req, res) => {
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: 'ADMIN_ONLY' });
      return;
    }
    const userId = String(req.params.userId || '').trim();
    const text = String(req.body?.text || '').trim().slice(0, 1000);
    const hasImageInput = typeof req.body?.imageData === 'string' && req.body.imageData.length > 0;
    const imageUrl = hasImageInput ? saveChatImageDataUrl(req.body.imageData) : undefined;

    if (hasImageInput && !imageUrl) {
      res.status(400).json({ error: 'INVALID_IMAGE' });
      return;
    }
    if (!userId || (!text && !imageUrl)) {
      res.status(400).json({ error: 'INVALID_MESSAGE' });
      return;
    }

    const all = ensureMessages();
    const existingThreadMsg = all.find((m) => m.userId === userId);
    const accounts = ensureAdminAccountSeeded();
    const acc = accounts.find((a) => a.userId === userId);

    const replyMsg: StoredChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      username: acc?.username || existingThreadMsg?.username || `User_${userId.slice(-2)}`,
      mobileNumber: acc?.mobileNumber || existingThreadMsg?.mobileNumber || '—',
      sender: 'agent',
      text,
      ...(imageUrl ? { imageUrl } : {}),
      createdAt: nowTimestamp(),
      readByAdmin: true,
      readByUser: false,
    };

    const nextAll = all.map((m) =>
      m.userId === userId && m.sender === 'user' && !m.readByAdmin
        ? { ...m, readByAdmin: true }
        : m
    );
    nextAll.push(replyMsg);
    saveMessages(nextAll);
    res.json({ ok: true, message: replyMsg });
  });

  // Admin: mark a user's messages as read (locked to +91 7285009425)
  app.post('/api/admin/messages/:userId/read', (req, res) => {
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: 'ADMIN_ONLY' });
      return;
    }
    const userId = String(req.params.userId || '').trim();
    const all = ensureMessages();
    let changed = false;
    const nextAll = all.map((m) => {
      if (m.userId === userId && m.sender === 'user' && !m.readByAdmin) {
        changed = true;
        return { ...m, readByAdmin: true };
      }
      return m;
    });
    if (changed) {
      saveMessages(nextAll);
    }
    res.json({ ok: true });
  });

  return app;
}

async function startStandaloneServer() {
  const app = createApp();
  const port = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

const isStandaloneEntry =
  !IS_VERCEL &&
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  Boolean(process.argv[1]) &&
  path.basename(process.argv[1]).startsWith('server.');

if (isStandaloneEntry) {
  void startStandaloneServer();
}
