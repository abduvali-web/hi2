"use client";

import React, { useMemo, useState } from "react";
import { useConsent } from "@/contexts/ConsentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ConsentBanner() {
  const { consent, setConsent } = useConsent();
  const [dismissed, setDismissed] = useState(false);

  const shouldShow = useMemo(() => {
    // Show banner only when analytics is denied and user hasn't dismissed it this session.
    return consent.analytics_storage !== "granted" && !dismissed;
  }, [consent.analytics_storage, dismissed]);

  if (!shouldShow) return null;

  const onAccept = () => {
    setConsent({ analytics_storage: "granted", ad_storage: "granted" });
    setDismissed(true);
  };

  const onDecline = () => {
    // Keep denied but hide the banner as requested by spec.
    setConsent({ analytics_storage: "denied", ad_storage: "denied" });
    setDismissed(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="mx-auto max-w-2xl">
        <Card className="border shadow-lg">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Analytics cookies help improve service. You can change later.
              </p>
              <p className="mt-1">
                Аналитические cookies помогают улучшить сервис. Вы можете изменить позже.
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button variant="outline" size="sm" onClick={onDecline}>
                Decline / Отклонить
              </Button>
              <Button size="sm" onClick={onAccept}>
                Accept / Принять
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ConsentBanner;