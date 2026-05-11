import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { ChatAssistant } from "../../components/ChatAssistant";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header />
          <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-8 md:px-8">
            <div className="max-w-7xl mx-auto flex flex-col gap-8 h-full">
               {children}
            </div>
          </main>
        </div>
      </div>
      {/* Floating AI assistant — available on all dashboard pages */}
      <ChatAssistant />
    </ProtectedRoute>
  );
}
