"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Props = {
  content: string | ReactNode;
  children: ReactNode;
  block?: boolean;
};

export function Tooltip({ content, children, block }: Props) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = useId();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0, placement: "top" as "top" | "bottom" });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const tipHeight = tipRef.current?.offsetHeight ?? 80;
    const tipWidth = tipRef.current?.offsetWidth ?? 260;
    const margin = 10;
    const gap = 8;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement =
      spaceAbove >= tipHeight + gap + margin || spaceAbove >= spaceBelow ? "top" : "bottom";
    const centerX = rect.left + rect.width / 2;
    const halfW = tipWidth / 2;
    const x = Math.min(window.innerWidth - margin - halfW, Math.max(margin + halfW, centerX));
    const y = placement === "top" ? rect.top - gap : rect.bottom + gap;
    setCoords({ x, y, placement });
  }, []);

  // Conteúdo assíncrono (ex.: radares) muda a altura depois de aberto: reposiciona.
  useEffect(() => {
    const tip = tipRef.current;
    if (!visible || !tip) return;
    const observer = new ResizeObserver(() => updatePosition());
    observer.observe(tip);
    return () => observer.disconnect();
  }, [visible, mounted, updatePosition]);

  const show = () => {
    setVisible(true);
    requestAnimationFrame(updatePosition);
  };

  if (!content) return <>{children}</>;

  const portal =
    visible && mounted
      ? createPortal(
          <div
            ref={tipRef}
            id={tipId}
            className={`tip-portal tip-portal-${coords.placement}`}
            style={{ left: coords.x, top: coords.y }}
            role="tooltip"
          >
            {content}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <span
        ref={triggerRef}
        className={`tip-wrap tip-wrap-trigger${block ? " tip-wrap-block" : ""}`}
        tabIndex={0}
        aria-describedby={visible ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        onFocus={show}
        onBlur={() => setVisible(false)}
      >
        {children}
      </span>
      {portal}
    </>
  );
}
