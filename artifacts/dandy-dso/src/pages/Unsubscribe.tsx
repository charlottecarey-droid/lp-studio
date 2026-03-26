import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const [status, setStatus] = useState<"loading" | "done" | "error" | "missing">("loading");

  useEffect(() => {
    if (!email) {
      setStatus("missing");
      return;
    }

    const process = async () => {
      try {
        // Check if already unsubscribed
        const { data: existing } = await supabase
          .from("email_unsubscribes")
          .select("id")
          .eq("email", email.toLowerCase())
          .maybeSingle();

        if (!existing) {
          await supabase
            .from("email_unsubscribes")
            .insert({ email: email.toLowerCase() });
        }

        setStatus("done");
      } catch {
        setStatus("error");
      }
    };

    process();
  }, [email]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <img
          src="/src/assets/dandy-logo.svg"
          alt="Dandy"
          className="h-8 mx-auto mb-8"
        />

        {status === "loading" && (
          <p className="text-muted-foreground">Processing your request…</p>
        )}

        {status === "done" && (
          <div className="space-y-3">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground">You've been unsubscribed</h1>
            <p className="text-muted-foreground">
              You won't receive further emails from Dandy Enterprise Sales.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              If this was a mistake, please contact{" "}
              <a href="mailto:charlotte.carey@meetdandy.com" className="text-primary underline">
                charlotte.carey@meetdandy.com
              </a>
            </p>
          </div>
        )}

        {status === "missing" && (
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-foreground">Invalid link</h1>
            <p className="text-muted-foreground">
              No email address was provided. Please use the unsubscribe link from your email.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground">
              We couldn't process your request. Please try again or contact{" "}
              <a href="mailto:charlotte.carey@meetdandy.com" className="text-primary underline">
                charlotte.carey@meetdandy.com
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
