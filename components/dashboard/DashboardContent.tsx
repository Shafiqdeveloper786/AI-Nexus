"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import CyberBackground from "@/components/CyberBackground";
import DashboardSidebar from "@/components/dashboard/Sidebar";
import TopNav from "@/components/dashboard/TopNav";
import ChatArea from "@/components/dashboard/ChatArea";
import ImageStudio from "@/components/dashboard/ImageStudio";
import ResumeBuilder from "@/components/dashboard/ResumeBuilder";
import HistoryView from "@/components/dashboard/HistoryView";
import WelcomeToast from "@/components/dashboard/WelcomeToast";
import RightSidebar from "@/components/dashboard/RightSidebar";
import ProfileModal from "@/components/dashboard/ProfileModal";
import type { UserProfileData } from "@/hooks/useUserProfile";

interface DashboardContentProps {
  /** Profile fetched server-side — seeds Sidebar/TopNav immediately with real data */
  serverProfile: UserProfileData;
}

export default function DashboardContent({ serverProfile }: DashboardContentProps) {
  const router = useRouter();
  const { status } = useSession();

  const [activeTool,        setActiveTool]        = useState("chat");
  const [currentChatId,     setCurrentChatId]     = useState<string | null>(null);
  const [sidebarOpen,       setSidebarOpen]       = useState(true);
  const [rightSidebarOpen,  setRightSidebarOpen]  = useState(true);
  const [profileOpen,       setProfileOpen]       = useState(false);
  const [profileTab,        setProfileTab]        = useState<"account"|"subscription"|"settings">("account");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  /** Open ProfileModal directly at the Subscription tab (called from credit-zero modals) */
  const handleOpenSubscription = useCallback(() => {
    setProfileTab("subscription");
    setProfileOpen(true);
  }, []);

  /* All hooks ABOVE any conditional returns */
  const handleToolChange = useCallback((tool: string) => {
    setActiveTool(tool);
    setCurrentChatId(null);
  }, []);

  const handleNewChat = useCallback(() => {
    setCurrentChatId(null);
  }, []);

  const handleChatCreated = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
    setHistoryRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/login");
  }, [status, router]);

  if (status === "loading") return null;

  return (
    <main className="relative flex h-screen overflow-hidden bg-[#030b1a]">
      <WelcomeToast
        name={serverProfile.name}
        credits={serverProfile.credits}
      />
      <CyberBackground />

      <DashboardSidebar
        isOpen={sidebarOpen}
        activeTool={activeTool}
        currentChatId={currentChatId}
        refreshHistoryKey={historyRefreshKey}
        initialProfile={serverProfile}
        onToolChange={handleToolChange}
        onChatSelect={(id) => setCurrentChatId(id)}
        onNewChat={handleNewChat}
        onToggle={() => setSidebarOpen((v) => !v)}
        onSettingsClick={() => setProfileOpen(true)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav
          activeTool={activeTool}
          initialProfile={serverProfile}
          onToolChange={handleToolChange}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onToggleRightSidebar={() => setRightSidebarOpen((v) => !v)}
          rightSidebarOpen={rightSidebarOpen}
          onOpenProfile={() => setProfileOpen(true)}
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <motion.div layout className="flex-1 min-w-0 overflow-hidden flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTool}-${currentChatId ?? "new"}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-h-0 flex flex-col overflow-hidden"
              >
                {activeTool === "image" ? (
                  <ImageStudio onOpenSubscription={handleOpenSubscription} />
                ) : activeTool === "resume" ? (
                  <ResumeBuilder onOpenSubscription={handleOpenSubscription} />
                ) : activeTool === "history" ? (
                  <HistoryView />
                ) : (
                  <ChatArea
                    activeTool={activeTool}
                    currentChatId={currentChatId}
                    onChatCreated={handleChatCreated}
                    onOpenSubscription={handleOpenSubscription}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <AnimatePresence initial={false}>
            {rightSidebarOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 272, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                className="hidden lg:block flex-shrink-0 overflow-hidden"
              >
                <RightSidebar />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ProfileModal
        isOpen={profileOpen}
        initialTab={profileTab}
        onClose={() => { setProfileOpen(false); setProfileTab("account"); }}
      />
    </main>
  );
}
