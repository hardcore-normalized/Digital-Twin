"use client";

import { useEffect, useState } from "react";

/** Sends the browser's timezone with a form (used to default the daily sync to the creator's 2 PM). */
export function TimezoneInput() {
  const [tz, setTz] = useState("");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  return <input type="hidden" name="timezone" value={tz} />;
}
