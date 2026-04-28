import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthContext";
import StatsPage from "@/features/stats/pages/StatsPage";

const Sessions = () => {
  const location = useLocation();
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-sm text-muted-foreground">
        Loading sessions...
      </div>
    );
  }

  if (!session) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <StatsPage
        emptyStateTitle="No sessions yet."
        emptyStateMessage="Send a voice message to @NoPauseAI_bot to get started!"
        showEmptyStateAction={false}
      />
    </div>
  );
};

export default Sessions;
