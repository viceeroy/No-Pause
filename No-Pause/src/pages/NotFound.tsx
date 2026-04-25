import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

	  return (
	    <div className="flex min-h-screen items-center justify-center bg-surface-base px-5 pb-24 pt-8">
	      <div className="w-full max-w-md rounded-[24px] border border-border bg-surface-elevated p-6 text-center shadow-card elevation-card">
	        <p className="mb-2 text-xs font-sans uppercase tracking-[0.16em] text-muted-foreground">404</p>
	        <h1 className="mb-3 text-3xl font-serif font-medium text-foreground">Page not found</h1>
	        <p className="mb-6 text-sm text-muted-foreground font-sans">This route does not exist or may have moved.</p>
	        <a href="/" className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-sans font-semibold text-primary-foreground shadow-soft hover:brightness-110">
	          Return Home
	        </a>
	      </div>
	    </div>
	  );
};

export default NotFound;
