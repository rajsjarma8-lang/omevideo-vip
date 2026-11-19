import React, { useState } from 'react';
import { useWalletStore } from './hooks/useWalletStore';
import { usePWAInstall } from './hooks/usePWAInstall';
import { AdminOrder, NavTab } from './types/wallet';
import { useLanguage } from './i18n/LanguageContext';
import { isAdminMobile } from './utils/formatters';
import { TopHeader } from './components/TopHeader';
import { BalanceHeroCard } from './components/BalanceHeroCard';
import { OrderGrabSection } from './components/OrderGrabSection';
import { OrderBreakdownModal } from './components/OrderBreakdownModal';
import { DepositWithdrawModal } from './components/DepositWithdrawModal';
import { AuthPage } from './components/AuthPage';
import { DownloadAppPage } from './components/DownloadAppPage';
import { PaymentView } from './components/PaymentView';
import { WalletView } from './components/WalletView';
import { StatisticsView } from './components/StatisticsView';
import { ProfileView } from './components/ProfileView';
import { SupportWidget } from './components/UtilityModals';
import { BottomNavBar } from './components/BottomNavBar';

export default function App() {
  const { lang } = useLanguage();
  const {
    isInstallable,
    isStandalone,
    envChecked,
    justInstalled,
    isIOS,
    install,
  } = usePWAInstall();
  const {
    state,
    adminUsers,
    userMessages,
    adminChatThreads,
    registerAccount,
    loginAccount,
    logoutAccount,
    linkPaymentApp,
    unlinkPaymentApp,
    addAdminOrder,
    removeAdminOrder,
    updateDefaultPaymentLink,
    submitOrderPayment,
    approvePendingOrder,
    rejectPendingOrder,
    withdrawFunds,
    approveWithdrawalRequest,
    rejectWithdrawalRequest,
    settlePendingWithdrawal,
    markNotificationsRead,
    syncAdminUsersFromServer,
    syncUserMessagesFromServer,
    sendUserSupportMessage,
    syncAdminMessagesFromServer,
    sendAdminChatReply,
    markAdminChatRead,
    resetUserPassword,
  } = useWalletStore(lang);

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // Step 1: Always require Login / Sign Up first when clicking any link
  if (!state.authAccount) {
    return (
      <AuthPage
        prefilledReferralCode={state.referredBy}
        onRegister={registerAccount}
        onLogin={loginAccount}
      />
    );
  }

  const isAdminUser = isAdminMobile(state.authAccount?.mobileNumber);

  // Step 2: In browser (outside the installed app / APK), show ONLY the full-page Download screen after login/signup.
  // Inside the installed standalone app or Android APK (isStandalone === true), this Download screen never appears.
  if (!isStandalone) {
    if (!envChecked) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#070B14]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/25 border-t-amber-400" />
        </div>
      );
    }
    return (
      <DownloadAppPage
        authAccount={state.authAccount}
        referredBy={state.referredBy}
        isInstallable={isInstallable}
        isIOS={isIOS}
        justInstalled={justInstalled}
        onInstallApp={install}
        onLogout={logoutAccount}
      />
    );
  }

  const handleOpenWallet = () => {
    setActiveTab('order');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenPaymentApps = () => {
    setActiveTab('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pendingCount = state.adminOrders.filter((o) => o.status === 'pending').length;
  const isPaymentAppLinked = Boolean(state.linkedPaymentApp);

  return (
    <div className="min-h-screen bg-[#04070E] text-slate-100">
      <div className="relative mx-auto min-h-screen max-w-[430px] border-x border-white/[0.06] bg-[#070B14] pb-20 shadow-2xl shadow-black">
        <TopHeader
          profile={state.profile}
          notifications={state.notifications}
          onSelectTab={setActiveTab}
          onMarkNotificationsRead={markNotificationsRead}
        />

        <main className="px-3.5 pt-3.5">
          {activeTab === 'home' && (
            <div className="space-y-3.5">
              <BalanceHeroCard
                walletBalance={state.walletBalance}
                totalPaid={state.totalPaid}
                totalWithdrawal={state.totalWithdrawal}
                totalCashbackEarned={state.totalCashbackEarned}
                onOpenWallet={handleOpenWallet}
                onOpenWithdraw={() => setWithdrawOpen(true)}
              />

              <OrderGrabSection
                adminOrders={state.adminOrders}
                isPaymentAppLinked={isPaymentAppLinked}
                onSelectOrder={(order) => setSelectedOrder(order)}
                onGoToPaymentApps={handleOpenPaymentApps}
                showPaidStatuses={false}
              />
            </div>
          )}

          {activeTab === 'order' && (
            <WalletView
              state={state}
              onSelectOrder={(order) => setSelectedOrder(order)}
              onOpenWithdraw={() => setWithdrawOpen(true)}
              onSettlePending={settlePendingWithdrawal}
              onGoToPaymentApps={handleOpenPaymentApps}
            />
          )}

          {activeTab === 'payment' && (
            <PaymentView
              linkedPaymentApp={state.linkedPaymentApp}
              onLinkPaymentApp={linkPaymentApp}
              onUnlinkPaymentApp={unlinkPaymentApp}
              onOrdersUnlockedGoHome={() => setActiveTab('home')}
            />
          )}

          {activeTab === 'statistics' && (
            <StatisticsView
              state={state}
              onSettlePending={settlePendingWithdrawal}
            />
          )}

          {activeTab === 'my' && (
            <ProfileView
              isAdmin={isAdminUser}
              profile={state.profile}
              referredBy={state.referredBy}
              authAccount={state.authAccount}
              adminOrders={state.adminOrders}
              withdrawRequests={state.withdrawRequests}
              adminUsers={adminUsers}
              adminChatThreads={adminChatThreads}
              referrals={state.referrals}
              referralBonusEarned={state.referralBonusEarned}
              defaultPaymentLink={state.defaultPaymentLink}
              onLogoutAccount={() => {
                logoutAccount();
                setActiveTab('home');
              }}
              onAddAdminOrder={addAdminOrder}
              onApproveOrder={approvePendingOrder}
              onRejectOrder={rejectPendingOrder}
              onRemoveAdminOrder={removeAdminOrder}
              onApproveWithdrawal={approveWithdrawalRequest}
              onRejectWithdrawal={rejectWithdrawalRequest}
              onRefreshAdminUsers={syncAdminUsersFromServer}
              onRefreshAdminMessages={syncAdminMessagesFromServer}
              onSendAdminChatReply={sendAdminChatReply}
              onMarkAdminChatRead={markAdminChatRead}
              onResetUserPassword={resetUserPassword}
              onUpdateDefaultPaymentLink={updateDefaultPaymentLink}
            />
          )}
        </main>

        <BottomNavBar
          activeTab={activeTab}
          pendingCount={pendingCount}
          onSelectTab={setActiveTab}
        />

        <SupportWidget
          availableBalance={state.walletBalance}
          messages={userMessages}
          onSendMessage={sendUserSupportMessage}
          onOpenMarkRead={() => {
            void syncUserMessagesFromServer(true);
          }}
        />
      </div>

      <OrderBreakdownModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onSubmitPayment={submitOrderPayment}
      />

      <DepositWithdrawModal
        isOpen={withdrawOpen}
        walletBalance={state.walletBalance}
        profile={state.profile}
        authMobile={state.authAccount?.mobileNumber}
        onClose={() => setWithdrawOpen(false)}
        onWithdraw={withdrawFunds}
      />
    </div>
  );
}
