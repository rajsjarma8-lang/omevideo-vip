import React, { useState, useEffect } from 'react';
import { Clock, X, ExternalLink, ArrowRight } from 'lucide-react';
import { AdminOrder } from '../types/wallet';
import { calculateCommission, formatINR } from '../utils/formatters';
import { useLanguage } from '../i18n/LanguageContext';

interface OrderBreakdownModalProps {
  order: AdminOrder | null;
  onClose: () => void;
  onSubmitPayment: (
    orderId: string,
    amount: number,
    utrReference?: string
  ) => {
    ok: boolean;
    error?: string;
    paidAmount?: number;
    cashback?: number;
    totalPayout?: number;
  };
}

function normalizePaymentUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '#';
  if (/^(https?:\/\/|upi:\/\/)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export const OrderBreakdownModal: React.FC<OrderBreakdownModalProps> = ({
  order,
  onClose,
  onSubmitPayment,
}) => {
  const { t } = useLanguage();
  const [step, setStep] = useState<'pay_link' | 'enter_utr' | 'pending'>('pay_link');
  const [utrRef, setUtrRef] = useState('');
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    paidAmount: number;
    totalPayout: number;
    utr: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setStep('pay_link');
    setErrorMsg(null);
    setUtrRef('');
    setSubmittedReceipt(null);
  }, [order]);

  if (!order) return null;

  const paymentUrl = normalizePaymentUrl(order.paymentLink);
  const { commission, totalReturn } = calculateCommission(order.amount);

  const handleSubmitUtr = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUtr = utrRef.trim();
    if (!cleanUtr || cleanUtr.length < 4) {
      setErrorMsg(t.utrInvalidError);
      return;
    }

    const res = onSubmitPayment(order.id, order.amount, cleanUtr);
    if (!res.ok) {
      setErrorMsg(res.error ?? t.submitPaymentFailed);
      return;
    }
    setSubmittedReceipt({
      paidAmount: res.paidAmount ?? order.amount,
      totalPayout: res.totalPayout ?? order.amount * 1.11,
      utr: cleanUtr,
    });
    setStep('pending');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-pay-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="w-full max-w-[410px] overflow-hidden rounded-t-3xl border border-white/10 bg-[#0F172A] shadow-2xl sm:rounded-3xl">
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-slate-700 sm:hidden" />

        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <div>
            <h3 id="order-pay-modal-title" className="text-sm font-bold text-slate-100">
              {step === 'pay_link' && `${t.orderPrefix} · ${formatINR(order.amount, false)}`}
              {step === 'enter_utr' && t.enterPaymentUtrTitle}
              {step === 'pending' && t.paymentSubmittedTitle}
            </h3>
            <p className="font-mono text-[11px] text-slate-400">
              {order.orderCode}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.cancelBtn}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5 p-4">
          {/* STEP 1: Order Amount + Single Bottom Payment Link Button */}
          {step === 'pay_link' && (
            <>
              <div className="rounded-xl border border-white/[0.08] bg-[#080D1A] p-4 text-center">
                <p className="text-[11px] font-medium text-slate-400">
                  {t.orderPaymentAmount}
                </p>
                <p className="mt-1 font-mono text-3xl font-bold text-white tabular-nums">
                  {formatINR(order.amount)}
                </p>
                <div className="mt-3 space-y-1.5 rounded-xl border border-emerald-400/20 bg-[#0F172A] px-3 py-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{t.commissionEarnShort} (+11%)</span>
                    <span className="font-mono font-bold text-emerald-300 tabular-nums">
                      +{formatINR(commission)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5">
                    <span className="font-semibold text-slate-200">{t.payoutAfterApprovalLabel}</span>
                    <span className="font-mono text-sm font-bold text-amber-300 tabular-nums">
                      {formatINR(totalReturn)}
                    </span>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] text-slate-400">
                  {t.tapBelowToOpenLink}
                </p>
              </div>

              <a
                href={paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setStep('enter_utr')}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-bold text-[#070B14] transition-transform hover:bg-amber-300 active:scale-[0.98]"
              >
                <span>
                  {t.payAmountNow} {formatINR(order.amount, false)}
                </span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          )}

          {/* STEP 2: Enter UTR After Payment on the Link */}
          {step === 'enter_utr' && (
            <form onSubmit={handleSubmitUtr} className="space-y-3">
              <div className="space-y-1.5 rounded-xl border border-white/[0.08] bg-[#080D1A] px-3.5 py-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{t.orderAmountLabel}</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {formatINR(order.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5">
                  <span className="text-slate-400">{t.payoutAfterApprovalLabel}</span>
                  <span className="font-mono font-bold text-emerald-300 tabular-nums">
                    {formatINR(totalReturn)} (+{formatINR(commission, false)})
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-slate-300">
                    {t.enterUtrLabel}
                  </label>
                  <a
                    href={paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200"
                  >
                    <span>{t.openLinkAgain}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <input
                  type="text"
                  autoFocus
                  value={utrRef}
                  onChange={(e) => {
                    setUtrRef(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder={t.utrPlaceholder}
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-[#080D1A] px-3.5 font-mono text-sm font-semibold text-white placeholder:font-sans placeholder:font-normal placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              {errorMsg && (
                <p className="text-[11px] font-medium text-rose-400">{errorMsg}</p>
              )}

              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-4 text-xs font-bold text-[#070B14] transition-colors hover:bg-amber-300 active:scale-[0.98]"
              >
                <span>{t.submitUtrBtn}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          )}

          {/* STEP 3: Pending Admin Approval */}
          {step === 'pending' && submittedReceipt && (
            <>
              <div className="flex flex-col items-center rounded-xl border border-amber-400/35 bg-amber-400/10 px-3.5 py-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-[#070B14]">
                  <Clock className="h-5 w-5" />
                </div>
                <span className="mt-2.5 inline-flex items-center rounded-md border border-amber-400/40 bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                  {t.statusPending}
                </span>
                <p className="mt-2 text-sm font-bold text-white">
                  {t.paymentSubmittedBanner}
                </p>
                <p className="mt-1 text-[11px] text-slate-300">
                  {t.utrSentToAdminDesc}
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-white/[0.08] bg-[#090F1E] p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.utrNumberLabel}</span>
                  <span className="font-mono font-bold text-emerald-300">
                    {submittedReceipt.utr}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.paidAmountLabel}</span>
                  <span className="font-mono font-semibold text-slate-100 tabular-nums">
                    {formatINR(submittedReceipt.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.payoutAfterApprovalLabel}</span>
                  <span className="font-mono font-semibold text-amber-300 tabular-nums">
                    {formatINR(submittedReceipt.totalPayout)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="h-10 w-full rounded-xl bg-amber-400 px-4 text-xs font-bold text-[#070B14] hover:bg-amber-300"
              >
                {t.doneBtn}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
