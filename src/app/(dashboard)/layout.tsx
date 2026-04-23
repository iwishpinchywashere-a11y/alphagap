import DashboardProvider from "@/components/dashboard/DashboardProvider";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardNav from "@/components/dashboard/DashboardNav";
import DashboardFooter from "@/components/dashboard/DashboardFooter";
import OnboardingTour from "@/components/dashboard/OnboardingTour";
import { WatchlistProvider } from "@/components/dashboard/WatchlistProvider";
import { NotificationProvider } from "@/components/dashboard/NotificationProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <WatchlistProvider>
        <NotificationProvider>
          <div className="flex flex-col min-h-screen">
            <DashboardHeader />
            <DashboardNav />
            {children}
            <DashboardFooter />
            <OnboardingTour />
          </div>
        </NotificationProvider>
      </WatchlistProvider>
    </DashboardProvider>
  );
}
