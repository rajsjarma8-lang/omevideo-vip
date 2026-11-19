import React, { useEffect, useRef, useState } from 'react';
import {
  User,
  Check,
  Copy,
  Shield,
  Lock,
  Send,
  Link2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ArrowLeft,
  PlusCircle,
  ClipboardCheck,
  Users,
  Share2,
  Gift,
  LogOut,
  Phone,
  ArrowUpRight,
  Building2,
  Smartphone,
  KeyRound,
  Search,
  RefreshCw,
  MessageCircle,
  CheckCheck,
  ImagePlus,
  X,
} from 'lucide-react';
import {
  AdminChatThread,
  AdminOrder,
  AdminUserRecord,
  AuthAccount,
  ReferralRecord,
  UserProfile,
  WithdrawRequest,
} from '../types/wallet';
import { calculateCommission, formatINR } from '../utils/formatters';
import { compressImageFileToDataUrl } from '../utils/imageHelper';
import { useLanguage } from '../i18n/LanguageContext';

interface ProfileViewProps {
  isAdmin: boolean;
  profile: UserProfile;
  referredBy: string | null;
  authAccount?: AuthAccount | null;
  adminOrders: AdminOrder[];
  withdrawRequests: WithdrawRequest[];
  adminUsers: AdminUserRecord[];
  adminChatThreads: AdminChatThread[];
  referrals: ReferralRecord[];
  referralBonusEarned: number;
  defaultPaymentLink: string;
  onLogoutAccount: () => void;
  onAddAdminOrder: (
    amount: number,
    paymentLink?: string
  ) => { ok: boolean; error?: string };
  onApproveOrder: (orderId: string) => void;
  onRejectOrder: (orderId: string) => void;
  onRemoveAdminOrder: (orderId: string) => void;
  onApproveWithdrawal: (withdrawalId: string) => void;
  onRejectWithdrawal: (withdrawalId: string) => void;
  onRefreshAdminUsers: () => void;
  onRefreshAdminMessages: () => void;
  onSendAdminChatReply: (
    userId: string,
    text: string,
    imageData?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onMarkAdminChatRead: (userId: string) => void;
  onResetUserPassword: (
    userId: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onUpdateDefaultPaymentLink: (link: string) => { ok: boolean; error?: string };
}

type ProfileScreen =
  | 'main'
  | 'admin_menu'
  | 'admin_add_order'
  | 'admin_approvals'
  | 'admin_withdrawals'
  | 'admin_users'
  | 'admin_messages';

function getAvatarColor(seed: string): string {
  const palette = [
    'bg-emerald-500/20 text-emerald-300 border-emerald-400/35',
    'bg-sky-500/20 text-sky-300 border-sky-400/35',
    'bg-amber-500/20 text-amber-300 border-amber-400/35',
    'bg-violet-500/20 text-violet-300 border-violet-400/35',
    'bg-teal-500/20 text-teal-300 border-teal-400/35',
    'bg-rose-500/20 text-rose-300 border-rose-400/35',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return 'U';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function formatChatTime(ts?: string): string {
  if (!ts) return '';
  const parts = ts.split(' ');
  return parts[1] ? parts[1].slice(0, 5) : ts;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  isAdmin,
  profile,
  referredBy,
  authAccount,
  adminOrders,
  withdrawRequests,
  adminUsers,
  adminChatThreads,
  referrals,
  referralBonusEarned,
  defaultPaymentLink,
  onLogoutAccount,
  onAddAdminOrder,
  onApproveOrder,
  onRejectOrder,
  onRemoveAdminOrder,
  onApproveWithdrawal,
  onRejectWithdrawal,
  onRefreshAdminUsers,
  onRefreshAdminMessages,
  onSendAdminChatReply,
  onMarkAdminChatRead,
  onResetUserPassword,
  onUpdateDefaultPaymentLink,
}) => {
  const { lang, t } = useLanguage();
  const [screen, setScreen] = useState<ProfileScreen>('main');

  // WhatsApp-style Messages inbox state
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState('');
  const [chatReplyInput, setChatReplyInput] = useState('');
  const [pendingChatPhoto, setPendingChatPhoto] = useState<string | null>(null);
  const [chatPhotoError, setChatPhotoError] = useState<string | null>(null);
  const [chatPreviewUrl, setChatPreviewUrl] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isAdmin && screen !== 'main') {
      setScreen('main');
    }
    if (!isAdmin || screen !== 'admin_messages') {
      setSelectedChatUserId(null);
      setPendingChatPhoto(null);
      setChatPhotoError(null);
    }
  }, [isAdmin, screen]);

  const activeChatThread = selectedChatUserId
    ? adminChatThreads.find((th) => th.userId === selectedChatUserId) || null
    : null;

  useEffect(() => {
    if (screen === 'admin_messages' && activeChatThread && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [screen, activeChatThread?.userId, activeChatThread?.messages.length]);

  const [copiedId, setCopiedId] = useState(false);
  const [copiedRefCode, setCopiedRefCode] = useState(false);
  const [copiedRefLink, setCopiedRefLink] = useState(false);

  // Admin state
  const [orderAmount, setOrderAmount] = useState<string>('1000');
  const [orderLink, setOrderLink] = useState<string>(defaultPaymentLink);
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Admin users directory state
  const [userSearch, setUserSearch] = useState('');
  const [resetTargetUserId, setResetTargetUserId] = useState<string | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const parsedAmount = Number(orderAmount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount >= 100;
  const payoutPreview = calculateCommission(validAmount ? parsedAmount : 0);

  const pendingApprovals = adminOrders.filter((o) => o.status === 'pending');
  const pendingWithdrawals = withdrawRequests.filter(
    (w) => w.status === 'Pending'
  );
  const totalUnreadMessages = adminChatThreads.reduce(
    (sum, th) => sum + th.unreadCount,
    0
  );
  const totalAdminPending =
    pendingApprovals.length + pendingWithdrawals.length + totalUnreadMessages;

  const referralCode = `AUREX-${profile.userId}`;
  const shareUrl = `${window.location.origin}/?ref=${referralCode}`;
  const registeredOnlyCount = referrals.filter((r) => r.status === 'registered').length;
  const completedReferralsCount = referrals.filter((r) => r.status === 'completed').length;
  const currentCycleCount = completedReferralsCount % 5;

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(profile.userId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleCopyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedRefCode(true);
      setTimeout(() => setCopiedRefCode(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleCopyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedRefLink(true);
      setTimeout(() => setCopiedRefLink(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleShareReferralLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Aurex Vault',
          text: `${t.shareInviteText} ${shareUrl}`,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or blocked in iframe; fallback to copy link
      }
    }
    await handleCopyReferralLink();
  };

  const handleSendAdminOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminFeedback(null);
    onUpdateDefaultPaymentLink(orderLink);
    const res = onAddAdminOrder(parsedAmount, orderLink);
    if (!res.ok) {
      setAdminError(res.error ?? t.unableCreateOrder);
      return;
    }
    setAdminFeedback(
      `${formatINR(parsedAmount, false)} ${t.orderSentToHomeSuffix}`
    );
    setTimeout(() => setAdminFeedback(null), 2800);
  };

  /* SCREEN 1: MAIN PROFILE VIEW */
  if (!isAdmin || screen === 'main') {
    return (
      <div className="space-y-3.5">
        {/* User Identity Header */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#0F172A] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-[#141F3B] text-amber-300">
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-white">{profile.username}</h2>
                {authAccount && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    {t.authLoggedInBadge}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="font-mono tabular-nums">ID: {profile.userId}</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200"
                >
                  {copiedId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedId ? t.copied : t.copy}</span>
                </button>
              </div>
              {referredBy && (
                <p className="mt-1 font-mono text-[10px] text-emerald-400">
                  {t.invitedByBadge} {referredBy}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onLogoutAccount}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/15 px-3 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-500/25 active:scale-[0.98]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{t.authLogoutBtn}</span>
          </button>
        </div>

        {/* Account Details Summary */}
        {authAccount && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/[0.08] bg-[#0F172A] px-4 py-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Phone className="h-4 w-4 text-amber-300" />
              <span className="font-mono font-semibold text-white">
                +91 {authAccount.mobileNumber}
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              {authAccount.username}
            </span>
          </div>
        )}

        {/* Dedicated Admin Button (Strictly locked to +91 7285009425) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              onRefreshAdminUsers();
              onRefreshAdminMessages();
              setScreen('admin_menu');
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-[#0F172A] p-3.5 text-left transition-colors hover:border-amber-400/55 hover:bg-[#141F3B] active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-amber-300">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{t.adminPanelTitle}</p>
                <p className="text-[11px] text-slate-400">{t.adminPanelDesc}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {totalAdminPending > 0 && (
                <span className="rounded-md bg-amber-400 px-2 py-0.5 font-mono text-[11px] font-bold text-[#070B14] tabular-nums">
                  {totalAdminPending} {t.pendingCountSuffix}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          </button>
        )}

        {/* Real Shareable Referral Code & 5-Referral ₹100 Bonus Section */}
        <section
          aria-label={t.referralSectionTitle}
          className="space-y-3.5 rounded-2xl border border-emerald-400/25 bg-[#0F172A] p-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">
                {t.referralSectionTitle}
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/35 bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">
              <Gift className="h-3 w-3" />
              {t.referralRuleBadge}
            </span>
          </div>

          {/* Shareable Link & Code Card */}
          <div className="space-y-3 rounded-xl border border-white/[0.08] bg-[#080D1A] p-3.5">
            <div>
              <p className="text-[11px] font-medium text-slate-400">
                {t.yourInviteCodeLabel}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-base font-bold tracking-wider text-amber-300">
                  {referralCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyReferralCode}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-amber-400/35 bg-amber-400/10 px-2.5 text-[11px] font-bold text-amber-300 hover:bg-amber-400/20"
                >
                  {copiedRefCode ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedRefCode ? t.copied : t.copyCodeBtn}</span>
                </button>
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-2.5">
              <p className="text-[11px] font-medium text-slate-400">
                {t.shareInviteLinkLabel}
              </p>
              <p className="mt-1 truncate rounded-lg border border-white/[0.07] bg-[#0F172A] px-2.5 py-2 font-mono text-[11px] text-slate-300">
                {shareUrl}
              </p>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyReferralLink}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#0F172A] px-3 text-[11px] font-bold text-slate-100 hover:border-amber-400/40 active:scale-[0.98]"
                >
                  {copiedRefLink ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-amber-300" />
                  )}
                  <span>{copiedRefLink ? t.linkCopiedBtn : t.copyLinkBtn}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareReferralLink}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 text-[11px] font-bold text-[#070B14] hover:bg-amber-300 active:scale-[0.98]"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>{t.shareLinkBtn}</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-400">
              {t.referralRuleDesc}
            </p>
          </div>

          {/* 5-Referral ₹100 Milestone Progress (Strictly Real Data) */}
          <div className="rounded-xl border border-white/[0.08] bg-[#080D1A] p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">
                {t.qualifiedProgressLabel}
              </span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums">
                {currentCycleCount} / 5
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                style={{ width: `${(currentCycleCount / 5) * 100}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-amber-300 transition-all duration-300"
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-white/[0.06] bg-[#0F172A] px-2 py-2">
                <p className="text-[10px] text-slate-400">{t.registeredOnlyLabel}</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-amber-300 tabular-nums">
                  {registeredOnlyCount}
                </p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-[#0F172A] px-2 py-2">
                <p className="text-[10px] text-slate-400">{t.orderCompletedLabel}</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-emerald-400 tabular-nums">
                  {completedReferralsCount}
                </p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-[#0F172A] px-2 py-2">
                <p className="text-[10px] text-slate-400">{t.referralEarnedLabel}</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-white tabular-nums">
                  {formatINR(referralBonusEarned, false)}
                </p>
              </div>
            </div>
          </div>

          {/* Read-Only Real Referred Friends Status List */}
          <div className="border-t border-white/[0.08] pt-3">
            <p className="text-xs font-bold text-slate-200">
              {t.referralTrackerTitle} ({referrals.length})
            </p>
            {referrals.length === 0 ? (
              <p className="py-3 text-center text-[11px] leading-relaxed text-slate-500">
                {t.noReferralsYet}
              </p>
            ) : (
              <div className="mt-2 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-[#080D1A] px-3">
                {referrals.map((ref) => (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between gap-2 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">
                        {ref.inviteeName}
                      </p>
                      <p
                        className={`mt-0.5 text-[10px] ${
                          ref.status === 'completed'
                            ? 'text-emerald-400'
                            : 'text-amber-300'
                        }`}
                      >
                        {ref.status === 'completed'
                          ? t.refStatusCompleted
                          : t.refStatusRegistered}
                      </p>
                    </div>

                    {ref.status === 'completed' ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{t.statusSuccess}</span>
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        <Clock className="h-3 w-3" />
                        <span>{t.statusPending}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  /* SCREEN 2: ADMIN MENU */
  if (screen === 'admin_menu') {
    return (
      <div className="space-y-3.5">
        <button
          type="button"
          onClick={() => setScreen('main')}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-[#0F172A] px-3 text-xs font-semibold text-slate-200 hover:border-amber-400/35"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t.backToProfile}</span>
        </button>

        <div className="rounded-2xl border border-amber-400/25 bg-[#0F172A] p-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-300" />
              <h2 className="text-sm font-bold text-white">{t.adminControlsTitle}</h2>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
              <Lock className="h-3 w-3" />
              {t.fixed11Badge}
            </span>
          </div>

          <div className="mt-3.5 space-y-2.5">
            {/* Button 1: Add Order */}
            <button
              type="button"
              onClick={() => setScreen('admin_add_order')}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#080D1A] p-3.5 text-left transition-colors hover:border-amber-400/45 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-amber-300">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{t.addOrderTitle}</p>
                  <p className="text-[11px] text-slate-400">{t.addOrderDesc}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>

            {/* Button 2: Approve / Reject User Payments */}
            <button
              type="button"
              onClick={() => setScreen('admin_approvals')}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#080D1A] p-3.5 text-left transition-colors hover:border-emerald-400/45 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-300">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {t.approveRejectTitle}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {t.approveRejectDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {pendingApprovals.length > 0 && (
                  <span className="rounded-md bg-amber-400 px-2 py-0.5 font-mono text-[11px] font-bold text-[#070B14] tabular-nums">
                    {pendingApprovals.length}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </button>

            {/* Button 3: User Withdrawal Requests */}
            <button
              type="button"
              onClick={() => setScreen('admin_withdrawals')}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#080D1A] p-3.5 text-left transition-colors hover:border-amber-400/45 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-amber-300">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {t.adminWithdrawalsTitle}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {t.adminWithdrawalsDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {pendingWithdrawals.length > 0 && (
                  <span className="rounded-md bg-amber-400 px-2 py-0.5 font-mono text-[11px] font-bold text-[#070B14] tabular-nums">
                    {pendingWithdrawals.length}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </button>

            {/* Button 4: User Profile Details (Mobile, Username, Password Status) */}
            <button
              type="button"
              onClick={() => {
                onRefreshAdminUsers();
                setScreen('admin_users');
              }}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#080D1A] p-3.5 text-left transition-colors hover:border-sky-400/45 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/15 text-sky-300">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {t.adminUsersTitle}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {t.adminUsersDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {adminUsers.length > 0 && (
                  <span className="rounded-md border border-sky-400/30 bg-sky-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-300 tabular-nums">
                    {adminUsers.length}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </button>

            {/* Button 5: WhatsApp-style User Messages Inbox */}
            <button
              type="button"
              onClick={() => {
                onRefreshAdminMessages();
                setSelectedChatUserId(null);
                setScreen('admin_messages');
              }}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#080D1A] p-3.5 text-left transition-colors hover:border-[#25D366]/55 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#25D366]/35 bg-[#25D366]/15 text-[#25D366]">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {t.adminMessagesTitle}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {t.adminMessagesDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {totalUnreadMessages > 0 && (
                  <span className="rounded-full bg-[#25D366] px-2 py-0.5 font-mono text-[11px] font-bold text-[#070B14] tabular-nums">
                    {totalUnreadMessages}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* SCREEN 3.2: WHATSAPP-STYLE USER MESSAGES INBOX & 1-ON-1 CHAT */
  if (screen === 'admin_messages') {
    if (activeChatThread) {
      const handleChatPhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setChatPhotoError(null);
        try {
          const compressed = await compressImageFileToDataUrl(file);
          setPendingChatPhoto(compressed);
        } catch {
          setChatPhotoError(t.invalidImageError);
        }
      };

      const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        const clean = chatReplyInput.trim();
        const img = pendingChatPhoto;
        if ((!clean && !img) || chatSending) return;
        setChatSending(true);
        setChatPhotoError(null);
        setChatReplyInput('');
        setPendingChatPhoto(null);
        await onSendAdminChatReply(
          activeChatThread.userId,
          clean,
          img || undefined
        );
        setChatSending(false);
      };

      return (
        <>
          <div className="flex flex-col overflow-hidden rounded-2xl border border-[#25D366]/25 bg-[#0B141A]">
            {/* WhatsApp Chat Header (No Call Buttons) */}
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] bg-[#202C33] px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChatUserId(null);
                    setPendingChatPhoto(null);
                    setChatPhotoError(null);
                  }}
                  aria-label={t.backToAdmin}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-200 hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>

                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${getAvatarColor(
                    activeChatThread.userId
                  )}`}
                >
                  {getInitials(activeChatThread.username)}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-white">
                    {activeChatThread.username}
                  </p>
                  <p className="truncate font-mono text-[10px] text-[#25D366]">
                    {activeChatThread.mobileNumber
                      ? `+91 ${activeChatThread.mobileNumber}`
                      : t.chatOnlineLabel}{' '}
                    · ID: {activeChatThread.userId}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onRefreshAdminMessages}
                aria-label="Refresh chat"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* WhatsApp Messages Thread */}
            <div
              ref={chatScrollRef}
              className="h-[390px] space-y-2 overflow-y-auto bg-[#0B141A] px-3 py-3"
            >
              {activeChatThread.messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="rounded-xl border border-white/[0.07] bg-[#182229] px-3.5 py-2 text-center text-[11px] text-slate-400">
                    {t.noMessagesYet}
                  </p>
                </div>
              ) : (
                activeChatThread.messages.map((m) => {
                  const isOutgoing = m.sender === 'agent';
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-2.5 py-2 text-xs leading-relaxed shadow-sm ${
                          isOutgoing
                            ? 'rounded-tr-none bg-[#005C4B] text-white'
                            : 'rounded-tl-none border border-white/[0.06] bg-[#202C33] text-slate-100'
                        }`}
                      >
                        {m.imageUrl && (
                          <button
                            type="button"
                            onClick={() => setChatPreviewUrl(m.imageUrl!)}
                            className="mb-1.5 block w-full overflow-hidden rounded-xl border border-white/10"
                          >
                            <img
                              src={m.imageUrl}
                              alt="Chat photo"
                              className="max-h-52 w-full object-cover"
                            />
                          </button>
                        )}
                        {m.text && <p className="px-0.5 break-words">{m.text}</p>}
                        <div className="mt-1 flex items-center justify-end gap-1 px-0.5 text-[9px] text-slate-300/75">
                          <span>{formatChatTime(m.createdAt)}</span>
                          {isOutgoing && (
                            <CheckCheck className="h-3 w-3 text-sky-300" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {chatPhotoError && (
              <p className="border-t border-white/[0.06] bg-[#202C33] px-3 py-1 text-[10px] font-medium text-rose-400">
                {chatPhotoError}
              </p>
            )}

            {pendingChatPhoto && (
              <div className="flex items-center justify-between gap-2 border-t border-white/[0.08] bg-[#182229] px-3 py-2">
                <div className="flex items-center gap-2">
                  <img
                    src={pendingChatPhoto}
                    alt="Selected preview"
                    className="h-11 w-11 rounded-lg border border-white/15 object-cover"
                  />
                  <span className="text-[11px] font-medium text-[#25D366]">
                    {t.photoBadgeText}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingChatPhoto(null)}
                  aria-label="Remove photo"
                  className="rounded-full bg-white/10 p-1 text-slate-300 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* WhatsApp Compose Bar with Photo Upload */}
            <form
              onSubmit={handleSendReply}
              className="flex items-center gap-2 border-t border-white/[0.08] bg-[#202C33] p-2.5"
            >
              <input
                ref={chatFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleChatPhotoPick}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                aria-label={t.attachPhotoLabel}
                title={t.attachPhotoLabel}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#2A3942] text-[#25D366] transition-colors hover:border-[#25D366]"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <input
                type="text"
                value={chatReplyInput}
                onChange={(e) => setChatReplyInput(e.target.value)}
                placeholder={
                  pendingChatPhoto ? t.photoCaptionPlaceholder : t.replyPlaceholder
                }
                className="h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-[#2A3942] px-4 text-xs text-white placeholder:text-slate-400 focus:border-[#25D366] focus:outline-none"
              />
              <button
                type="submit"
                disabled={chatSending || (!chatReplyInput.trim() && !pendingChatPhoto)}
                aria-label="Send reply"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-[#070B14] transition-transform hover:bg-[#25D366] active:scale-95 disabled:opacity-45"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Full-screen photo preview modal */}
          {chatPreviewUrl && (
            <div
              role="dialog"
              aria-modal="true"
              onClick={() => setChatPreviewUrl(null)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="relative max-h-[85vh] max-w-[410px]"
              >
                <button
                  type="button"
                  onClick={() => setChatPreviewUrl(null)}
                  aria-label={t.closePreviewLabel}
                  className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-[#0F172A] text-white shadow-lg"
                >
                  <X className="h-4 w-4" />
                </button>
                <img
                  src={chatPreviewUrl}
                  alt="Full view"
                  className="max-h-[82vh] w-auto rounded-2xl border border-white/15 object-contain shadow-2xl"
                />
              </div>
            </div>
          )}
        </>
      );
    }

    const q = chatSearch.trim().toLowerCase();
    const filteredThreads = adminChatThreads.filter((th) => {
      if (!q) return true;
      return (
        th.username.toLowerCase().includes(q) ||
        th.mobileNumber.includes(q) ||
        th.userId.toLowerCase().includes(q) ||
        (th.lastMessage ?? '').toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setScreen('admin_menu')}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-[#0F172A] px-3 text-xs font-semibold text-slate-200 hover:border-amber-400/35"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t.backToAdmin}</span>
          </button>

          <button
            type="button"
            onClick={onRefreshAdminMessages}
            aria-label="Refresh messages"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-[#0F172A] px-3 text-xs font-semibold text-slate-200 hover:border-[#25D366]/45"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[#25D366]" />
            <span className="font-mono text-[11px]">{adminChatThreads.length}</span>
          </button>
        </div>

        {/* WhatsApp-style Chats List Container */}
        <div className="overflow-hidden rounded-2xl border border-[#25D366]/25 bg-[#111B21]">
          <div className="border-b border-white/[0.08] bg-[#202C33] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[#25D366]" />
                <h2 className="text-sm font-bold text-white">
                  {t.adminMessagesTitle}
                </h2>
              </div>
              {totalUnreadMessages > 0 && (
                <span className="rounded-full bg-[#25D366] px-2 py-0.5 font-mono text-[10px] font-bold text-[#070B14]">
                  {totalUnreadMessages} {t.newBadge}
                </span>
              )}
            </div>

            <div className="relative mt-2.5">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder={t.messagesSearchPlaceholder}
                className="h-9 w-full rounded-xl border border-white/10 bg-[#111B21] pr-3 pl-9 text-xs text-white placeholder:text-slate-400 focus:border-[#25D366] focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-[460px] divide-y divide-white/[0.06] overflow-y-auto">
            {filteredThreads.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                {t.noMessagesYet}
              </p>
            ) : (
              filteredThreads.map((th) => {
                const lastMsg = th.messages[th.messages.length - 1];
                const lastFromAgent = lastMsg?.sender === 'agent';
                return (
                  <button
                    key={th.userId}
                    type="button"
                    onClick={() => {
                      setSelectedChatUserId(th.userId);
                      if (th.unreadCount > 0) {
                        onMarkAdminChatRead(th.userId);
                      }
                    }}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[#202C33]/75 active:bg-[#202C33]"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${getAvatarColor(
                        th.userId
                      )}`}
                    >
                      {getInitials(th.username)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-bold text-white">
                          {th.username}
                        </p>
                        <span
                          className={`shrink-0 font-mono text-[10px] ${
                            th.unreadCount > 0 ? 'font-bold text-[#25D366]' : 'text-slate-400'
                          }`}
                        >
                          {formatChatTime(th.lastTime)}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1 text-[11px] text-slate-400">
                          {lastMsg ? (
                            <>
                              {lastFromAgent && (
                                <CheckCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                              )}
                              <span
                                className={`truncate ${
                                  th.unreadCount > 0 ? 'font-semibold text-slate-200' : ''
                                }`}
                              >
                                {th.lastMessage}
                              </span>
                            </>
                          ) : (
                            <span className="truncate text-slate-500">
                              {th.mobileNumber ? `+91 ${th.mobileNumber} · ` : ''}
                              {t.tapToStartChat}
                            </span>
                          )}
                        </div>

                        {th.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 font-mono text-[10px] font-bold text-[#070B14] tabular-nums">
                            {th.unreadCount}
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
                        {th.mobileNumber ? `+91 ${th.mobileNumber} · ` : ''}ID: {th.userId}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  /* SCREEN 3.5: ADMIN USERS PROFILE DIRECTORY */
  if (screen === 'admin_users') {
    const mergedUsers: AdminUserRecord[] = [...adminUsers];
    if (
      authAccount &&
      !mergedUsers.some((u) => u.userId === authAccount.userId)
    ) {
      mergedUsers.unshift({
        userId: authAccount.userId,
        mobileNumber: authAccount.mobileNumber,
        username: authAccount.username,
        hasPassword: true,
        referralCode: authAccount.referralCode,
        referredBy: authAccount.referredBy,
        createdAt: authAccount.createdAt,
        walletBalance: 0,
        totalPaid: 0,
        totalWithdrawal: 0,
        upiId: profile.upiId,
      });
    }

    const q = userSearch.trim().toLowerCase();
    const filteredUsers = mergedUsers.filter((u) => {
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        u.mobileNumber.includes(q) ||
        u.userId.toLowerCase().includes(q) ||
        u.referralCode.toLowerCase().includes(q)
      );
    });

    const handleResetPasswordSubmit = async (e: React.FormEvent, targetId: string) => {
      e.preventDefault();
      setResetError(null);
      setResetFeedback(null);
      setResetSubmitting(true);
      const res = await onResetUserPassword(targetId, resetPasswordInput);
      setResetSubmitting(false);
      if (!res.ok) {
        setResetError(res.error ?? t.errAuthGeneric);
        return;
      }
      setResetFeedback(t.passwordUpdatedMsg);
      setResetPasswordInput('');
      setTimeout(() => {
        setResetTargetUserId(null);
        setResetFeedback(null);
      }, 1100);
    };

    return (
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setScreen('admin_menu')}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-[#0F172A] px-3 text-xs font-semibold text-slate-200 hover:border-amber-400/35"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t.backToAdmin}</span>
          </button>

          <button
            type="button"
            onClick={onRefreshAdminUsers}
            aria-label="Refresh users"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-[#0F172A] px-3 text-xs font-semibold text-slate-200 hover:border-sky-400/40"
          >
            <RefreshCw className="h-3.5 w-3.5 text-sky-300" />
            <span className="font-mono text-[11px]">{mergedUsers.length}</span>
          </button>
        </div>

        <div className="rounded-2xl border border-sky-400/25 bg-[#0F172A] p-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-sky-300" />
              <h2 className="text-sm font-bold text-white">
                {t.adminUsersTitle} ({filteredUsers.length})
              </h2>
            </div>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder={t.adminUsersSearchPlaceholder}
              className="h-9 w-full rounded-xl border border-white/10 bg-[#080D1A] pr-3 pl-9 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
            />
          </div>

          {filteredUsers.length === 0 ? (
            <p className="py-5 text-center text-xs text-slate-500">
              {t.noRegisteredUsersYet}
            </p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {filteredUsers.map((u) => {
                const isEditingPass = resetTargetUserId === u.userId;
                return (
                  <div
                    key={u.userId}
                    className="space-y-2 rounded-xl border border-white/[0.08] bg-[#080D1A] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-400/30 bg-sky-500/15 text-sky-300">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-white">
                            {u.username}
                          </p>
                          <p className="font-mono text-[10px] text-slate-400">
                            ID: {u.userId} · {u.referralCode}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
                        {formatINR(u.walletBalance)}
                      </span>
                    </div>

                    {/* Core Credentials: Mobile Number, Username, Password Status */}
                    <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-white/[0.06] bg-[#0F172A] p-2.5 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">{t.authMobileLabel}</span>
                        <span className="font-mono font-bold text-amber-300">
                          +91 {u.mobileNumber}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">{t.authUsernameLabel}</span>
                        <span className="font-semibold text-white">
                          {u.username}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">{t.authPasswordLabel}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs tracking-wider text-slate-300">
                            ••••••••
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                            <Lock className="h-2.5 w-2.5" />
                            {t.passwordEncryptedLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setResetTargetUserId(
                                isEditingPass ? null : u.userId
                              );
                              setResetPasswordInput('');
                              setResetError(null);
                              setResetFeedback(null);
                            }}
                            className="inline-flex items-center gap-1 rounded border border-amber-400/35 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-amber-400/20"
                          >
                            <KeyRound className="h-2.5 w-2.5" />
                            <span>{t.resetPasswordBtn}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {isEditingPass && (
                      <form
                        onSubmit={(e) => handleResetPasswordSubmit(e, u.userId)}
                        className="space-y-1.5 rounded-lg border border-amber-400/30 bg-[#0F172A] p-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={resetPasswordInput}
                            onChange={(e) => {
                              setResetPasswordInput(e.target.value);
                              if (resetError) setResetError(null);
                            }}
                            placeholder={t.newPasswordPlaceholder}
                            className="h-8 flex-1 rounded-lg border border-white/15 bg-[#080D1A] px-2.5 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={resetSubmitting}
                            className="h-8 shrink-0 rounded-lg bg-amber-400 px-3 text-[11px] font-bold text-[#070B14] hover:bg-amber-300 disabled:opacity-50"
                          >
                            {t.savePasswordBtn}
                          </button>
                        </div>
                        {resetError && (
                          <p className="text-[10px] font-medium text-rose-400">
                            {resetError}
                          </p>
                        )}
                        {resetFeedback && (
                          <p className="text-[10px] font-medium text-emerald-400">
                            {resetFeedback}
                          </p>
                        )}
                      </form>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                      <span>
                        {t.paidLabel}: {formatINR(u.totalPaid, false)} · {t.withdrawLabel}:{' '}
                        {formatINR(u.totalWithdrawal, false)}
                      </span>
                      {u.linkedAppName && (
                        <span className="text-emerald-400">
                          {t.linkedAppLabel} {u.linkedAppName}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                      <span>
                        {t.joinedAtLabel} {u.createdAt}
                      </span>
                      {u.referredBy && (
                        <span className="font-mono text-emerald-400">
                          {t.invitedByBadge} {u.referredBy}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* SCREEN 3: ADD ORDER SCREEN */
  if (screen === 'admin_add_order') {
    return (
      <div className="space-y-3.5">
        <button
          type="button"
          onClick={() => setScreen('admin_menu')}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-[#0F172A] px-3 text-xs font-semibold text-slate-200 hover:border-amber-400/35"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t.backToAdmin}</span>
        </button>

        <form
          onSubmit={handleSendAdminOrder}
          className="space-y-3.5 rounded-2xl border border-amber-400/25 bg-[#0F172A] p-4"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div>
              <h2 className="text-sm font-bold text-white">{t.addNewOrderTitle}</h2>
              <p className="text-[11px] text-slate-400">{t.fixedCommissionHint}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
              <Lock className="h-3 w-3" />
              {t.fixed11Badge}
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300">
              {t.orderAmountInrLabel}
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                min="100"
                step="any"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                placeholder="1000"
                className="h-10 w-full rounded-xl border border-white/10 bg-[#080D1A] pr-3 pl-7 font-mono text-sm font-bold text-white focus:border-amber-400 focus:outline-none tabular-nums"
              />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[500, 1000, 3000, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setOrderAmount(String(amt))}
                  className={`h-8 rounded-lg border font-mono text-[11px] font-semibold tabular-nums ${
                    Number(orderAmount) === amt
                      ? 'border-amber-400/60 bg-amber-400/20 text-amber-300'
                      : 'border-white/10 bg-[#080D1A] text-slate-300'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[11px] font-medium text-slate-300">
              <Link2 className="h-3 w-3 text-emerald-400" />
              {t.paymentLinkUrlLabel}
            </label>
            <input
              type="text"
              value={orderLink}
              onChange={(e) => setOrderLink(e.target.value)}
              placeholder="https://your-payment-link.com/pay"
              className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#080D1A] px-3 font-mono text-[11px] text-white focus:border-emerald-400 focus:outline-none"
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              {t.walletReceivesHint}{' '}
              <strong className="font-mono text-emerald-400">
                {formatINR(payoutPreview.totalReturn, false)}
              </strong>{' '}
              ({formatINR(payoutPreview.principal, false)} + 11%)
            </p>
          </div>

          {adminError && <p className="text-[11px] font-medium text-rose-400">{adminError}</p>}
          {adminFeedback && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-[11px] font-medium text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>{adminFeedback}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!validAmount}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 px-4 text-xs font-bold text-[#070B14] transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            <span>
              {lang === 'zh'
                ? `${t.sendOrderBtn} (${formatINR(payoutPreview.principal, false)})`
                : `Send ${formatINR(payoutPreview.principal, false)} Order`}
            </span>
          </button>
        </form>
      </div>
    );
  }

  /* SCREEN 4: USER WITHDRAWAL REQUESTS SCREEN */
  if (screen === 'admin_withdrawals') {
    const getMethodLabel = (method: WithdrawRequest['method']) => {
      if (method === 'bank') return t.withdrawMethodBank;
      if (method === 'mobile') return t.withdrawMethodMobile;
      return t.withdrawMethodUpi;
    };

    return (
      <div className="space-y-3.5">
        <button
          type="button"
          onClick={() => setScreen('admin_menu')}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-[#0F172A] px-3 text-xs font-semibold text-slate-200 hover:border-amber-400/35"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t.backToAdmin}</span>
        </button>

        {/* Pending Withdrawals Card */}
        <div className="rounded-2xl border border-amber-400/25 bg-[#0F172A] p-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-300" />
              <h2 className="text-sm font-bold text-amber-300">
                {t.pendingWithdrawalsTitle} ({pendingWithdrawals.length})
              </h2>
            </div>
          </div>

          {pendingWithdrawals.length === 0 ? (
            <p className="py-5 text-center text-xs text-slate-500">
              {t.noPendingWithdrawals}
            </p>
          ) : (
            <div className="mt-2 divide-y divide-white/[0.07]">
              {pendingWithdrawals.map((w) => (
                <div
                  key={w.id}
                  className="space-y-2.5 py-3 first:pt-2 last:pb-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-lg font-bold text-white tabular-nums">
                        {formatINR(w.amount)}
                      </span>
                      <span className="ml-2 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                        {getMethodLabel(w.method)}
                      </span>
                    </div>
                    <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      {t.statusPending}
                    </span>
                  </div>

                  {/* User & Payout Account / UPI / Mobile Details Box */}
                  <div className="space-y-1.5 rounded-xl border border-white/[0.08] bg-[#080D1A] p-3 text-[11px]">
                    <div className="flex items-center justify-between gap-2 text-slate-300">
                      <span className="font-semibold text-white">
                        {w.username} (ID: {w.userId})
                      </span>
                      {w.userMobile && (
                        <span className="font-mono text-[10px] text-slate-400">
                          +91 {w.userMobile}
                        </span>
                      )}
                    </div>

                    <div className="border-t border-white/[0.06] pt-1.5">
                      <p className="text-[10px] font-medium text-slate-400">
                        {t.payoutDetailsLabel}
                      </p>
                      {w.method === 'upi' && (
                        <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-300">
                          <Smartphone className="h-3.5 w-3.5 shrink-0" />
                          <span>{w.upiId || w.accountDetailSummary}</span>
                        </p>
                      )}
                      {w.method === 'bank' && (
                        <div className="mt-0.5 space-y-0.5 font-mono text-xs text-emerald-300">
                          <p className="flex items-center gap-1.5 font-sans font-bold">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            <span>{w.bankName}</span>
                          </p>
                          <p className="font-bold">A/C: {w.accountNumber}</p>
                          {w.ifscCode && (
                            <p className="text-[11px] text-slate-300">
                              IFSC: {w.ifscCode}
                            </p>
                          )}
                        </div>
                      )}
                      {w.method === 'mobile' && (
                        <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-300">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>+91 {w.mobileNumber}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="font-mono text-[10px] text-slate-500">
                    {t.submittedAtLabel} {w.createdAt}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onApproveWithdrawal(w.id)}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 text-xs font-bold text-[#05130E] hover:bg-emerald-400"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{t.withdrawApproveBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectWithdrawal(w.id)}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 text-xs font-bold text-rose-300 hover:bg-rose-500/25"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>{t.withdrawRejectBtn}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Withdrawal Records Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0F172A] p-4">
          <p className="text-xs font-bold text-slate-200">
            {t.allWithdrawalsTitle} ({withdrawRequests.length})
          </p>
          <div className="mt-2 divide-y divide-white/[0.06]">
            {withdrawRequests.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">
                {t.noWithdrawalsYet}
              </p>
            ) : (
              withdrawRequests.map((w) => (
                <div
                  key={w.id}
                  className="flex items-start justify-between gap-2 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white tabular-nums">
                        {formatINR(w.amount)}
                      </span>
                      <span className="text-[10px] font-semibold text-amber-300">
                        {getMethodLabel(w.method)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[11px] font-semibold text-emerald-300">
                      {w.accountDetailSummary}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {w.username} · ID {w.userId} · {w.createdAt}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${
                      w.status === 'Success'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : w.status === 'Rejected'
                        ? 'bg-rose-500/15 text-rose-300'
                        : 'bg-amber-400/15 text-amber-300'
                    }`}
                  >
                    {w.status === 'Success' && t.statusSuccess}
                    {w.status === 'Rejected' && t.statusRejected}
                    {w.status === 'Pending' && t.statusPending}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  /* SCREEN 5: APPROVE / REJECT USER PAYMENTS SCREEN */
  return (
    <div className="space-y-3.5">
      <button
        type="button"
        onClick={() => setScreen('admin_menu')}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-[#0F172A] px-3 text-xs font-semibold text-slate-200 hover:border-amber-400/35"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>{t.backToAdmin}</span>
      </button>

      {/* Pending Approvals Card */}
      <div className="rounded-2xl border border-amber-400/25 bg-[#0F172A] p-4">
        <div className="flex items-center gap-1.5 border-b border-white/[0.08] pb-2.5">
          <Clock className="h-4 w-4 text-amber-300" />
          <h2 className="text-sm font-bold text-amber-300">
            {t.pendingApprovalsTitle} ({pendingApprovals.length})
          </h2>
        </div>

        {pendingApprovals.length === 0 ? (
          <p className="py-5 text-center text-xs text-slate-500">
            {t.noPaidOrdersWaiting}
          </p>
        ) : (
          <div className="mt-2 divide-y divide-white/[0.07]">
            {pendingApprovals.map((order) => {
              const { principal, totalReturn } = calculateCommission(order.amount);
              return (
                <div key={order.id} className="space-y-2.5 py-3 first:pt-2 last:pb-1">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-base font-bold text-white tabular-nums">
                        {formatINR(principal, false)}
                      </span>
                      <span className="ml-2 font-mono text-xs text-emerald-400 tabular-nums">
                        → {formatINR(totalReturn, false)}
                      </span>
                    </div>
                    <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      {t.statusPending}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.07] bg-[#0F172A] px-2.5 py-1.5 font-mono text-[11px]">
                    {order.userName && (
                      <>
                        <span className="font-sans font-semibold text-slate-200">
                          {order.userName}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                      </>
                    )}
                    <span className="text-slate-400">{order.orderCode}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="font-bold text-emerald-300">
                      UTR: {order.utrRef || t.utrNotProvided}
                    </span>
                  </div>
                  {order.paidAt && (
                    <p className="font-mono text-[10px] text-slate-500">
                      {t.submittedAtLabel} {order.paidAt}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onApproveOrder(order.id)}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 text-xs font-bold text-[#05130E] hover:bg-emerald-400"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{t.approveSuccessBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectOrder(order.id)}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 text-xs font-bold text-rose-300 hover:bg-rose-500/25"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>{t.rejectBtn}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All Orders Status Log */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0F172A] p-4">
        <p className="text-xs font-bold text-slate-200">
          {t.allAdminOrdersTitle} ({adminOrders.length})
        </p>
        <div className="mt-2 divide-y divide-white/[0.06]">
          {adminOrders.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">
              {t.noOrdersCreatedYet}
            </p>
          ) : (
            adminOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white tabular-nums">
                      {formatINR(order.amount, false)}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        order.status === 'active'
                          ? 'text-slate-300'
                          : order.status === 'pending'
                          ? 'text-amber-300'
                          : order.status === 'success'
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {order.status === 'active' && t.statusActive}
                      {order.status === 'pending' && t.statusPending}
                      {order.status === 'success' && t.statusSuccess}
                      {order.status === 'rejected' && t.statusRejected}
                    </span>
                  </div>
                  <p className="truncate font-mono text-[10px] text-slate-400">
                    {order.orderCode}
                    {order.utrRef ? ` · UTR: ${order.utrRef}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAdminOrder(order.id)}
                  aria-label="Remove order"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:border-rose-500/40 hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
