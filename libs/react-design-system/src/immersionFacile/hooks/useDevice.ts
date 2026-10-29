import { useState } from "react";

export type Device = "mobile" | "tablet" | "desktop";

const getDevice = (): Device => {
  const { userAgent, maxTouchPoints } = navigator;
  const isIpadWithDesktopUserAgent =
    /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
  if (
    isIpadWithDesktopUserAgent ||
    /iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)
  )
    return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) return "mobile";
  return "desktop";
};

export const useDevice = (): Device => {
  const [device] = useState(getDevice);
  return device;
};
