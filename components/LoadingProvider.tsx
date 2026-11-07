"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SiteLogo } from "@/components/SiteLogo";

type LoadingApi = {
  beginLoad: (reason?: string) => void;
  endLoad: () => void;
};

const LoadingContext = createContext<LoadingApi | null>(null);

export function useLoading(): LoadingApi {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    return {
      beginLoad: () => {},
      endLoad: () => {},
    };
  }
  return ctx;
}

const SHOW_DELAY_MS = 180;
const SAFETY_MS = 14_000;

export function LoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams?.toString() ?? "";

  const pending = useRef(0);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);

  const clearShowTimer = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  };

  const clearSafety = () => {
    if (safetyTimer.current) {
      clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
  };

  const syncVisible = useCallback(() => {
    if (pending.current <= 0) {
      clearShowTimer();
      clearSafety();
      setVisible(false);
      return;
    }
    if (showTimer.current) return;
    showTimer.current = setTimeout(() => {
      showTimer.current = null;
      if (pending.current > 0) setVisible(true);
    }, SHOW_DELAY_MS);
    clearSafety();
    safetyTimer.current = setTimeout(() => {
      pending.current = 0;
      clearShowTimer();
      setVisible(false);
    }, SAFETY_MS);
  }, []);

  const beginLoad = useCallback(() => {
    pending.current += 1;
    syncVisible();
  }, [syncVisible]);

  const endLoad = useCallback(() => {
    pending.current = Math.max(0, pending.current - 1);
    if (pending.current === 0) {
      clearShowTimer();
      clearSafety();
      setVisible(false);
    } else {
      syncVisible();
    }
  }, [syncVisible]);

  useEffect(() => {
    pending.current = 0;
    clearShowTimer();
    clearSafety();
    setVisible(false);
  }, [pathname, searchKey]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (/^https?:\/\//i.test(href)) {
        try {
          const url = new URL(href);
          if (url.origin !== window.location.origin) return;
        } catch {
          return;
        }
      }
      beginLoad();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [beginLoad]);

  return (
    <LoadingContext.Provider value={{ beginLoad, endLoad }}>
      {children}
      {visible ? (
        <div className="global-loading-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="global-loading-card">
            <SiteLogo variant="mark" className="global-loading-logo" height={56} alt="" />
            <span className="global-loading-text">
              <i className="fa-solid fa-circle-notch global-loading-spin" aria-hidden="true" />
              Carregando…
            </span>
          </div>
        </div>
      ) : null}
    </LoadingContext.Provider>
  );
}
