import DashboardProvider from "@/components/dashboard/DashboardProvider";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardNav from "@/components/dashboard/DashboardNav";
import DashboardFooter from "@/components/dashboard/DashboardFooter";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <div className="flex flex-col min-h-screen">
        <DashboardHeader />
        <DashboardNav />
        {children}
        <DashboardFooter />
      </div>
    </DashboardProvider>
  );
}
