"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { StatSectionSpec } from "@/lib/aspectStatSections";

function fold(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

type Metric = { key: string; label: string; section?: string };

type Props = {
  axis: "x" | "y";
  metrics: Metric[];
  groups?: StatSectionSpec[];
  /** Chave composta — stats somadas separam por "||". */
  value: string;
  otherValue: string;
  plottedLabel?: string;
  /** Render only the picker control — for embedding inside the chart. */
  bare?: boolean;
  onChange: (key: string) => void;
  onSwap: () => void;
};

export function MetricAxisPicker({
  axis,
  metrics,
  groups,
  value,
  otherValue,
  plottedLabel,
  bare = false,
  onChange,
  onSwap,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);

  const selectedKeys = value.split("||").filter(Boolean);
  const otherKeys = otherValue.split("||").filter(Boolean);

  // O painel vai por portal ao <body>: a rail do scatter tem overflow:auto e
  // cortaria um dropdown posicionado por absolute.
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const up = spaceBelow < 300 && rect.top > spaceBelow;
      setPos(
        up
          ? { left: rect.left, bottom: window.innerHeight - rect.top + 6, width: Math.max(rect.width, 250) }
          : { left: rect.left, top: rect.bottom + 6, width: Math.max(rect.width, 250) },
      );
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Clique na linha troca a stat do eixo (caso comum) e fecha o painel.
  function replaceWith(key: string) {
    onChange(key);
    setOpen(false);
    setQuery("");
  }

  // "+" soma a stat ao eixo sem fechar o painel.
  function addKey(key: string) {
    if (selectedKeys.includes(key)) return;
    onChange([...selectedKeys, key].join("||"));
  }

  function removeKey(key: string) {
    const next = selectedKeys.filter((item) => item !== key);
    if (next.length) onChange(next.join("||"));
  }

  const q = fold(query.trim());
  const matches = (metric: Metric) => !q || fold(metric.label).includes(q);

  const sections = (groups ?? [])
    .map((section) => ({
      title: section.title,
      options: metrics.filter((metric) => metric.section === section.title && matches(metric)),
    }))
    .filter((section) => section.options.length);
  const sectioned = new Set(sections.flatMap((section) => section.options.map((option) => option.key)));
  const extra = metrics.filter((metric) => !sectioned.has(metric.key) && matches(metric));
  const hasAny = sections.length > 0 || extra.length > 0;

  const chips = selectedKeys.map((key) => ({ key, label: metricLabel(metrics, key) }));
  const triggerLabel = chips[0]?.label ?? plottedLabel ?? "Escolher métricas";

  const renderOption = (metric: Metric) => {
    const isSelected = selectedKeys.includes(metric.key);
    const isOther = otherKeys.includes(metric.key);
    return (
      <div key={metric.key} className={`axis-ms-option${isSelected ? " is-selected" : ""}`}>
        <button type="button" className="axis-ms-option-main" onClick={() => replaceWith(metric.key)} title={metric.label}>
          {isSelected ? <i className="fa-solid fa-check" aria-hidden="true" /> : null}
          <span>{metric.label}</span>
          {isOther ? <em className="axis-ms-other">no outro eixo</em> : null}
        </button>
        {!isSelected ? (
          <button
            type="button"
            className="axis-ms-add"
            onClick={() => addKey(metric.key)}
            title={`Somar "${metric.label}" ao eixo`}
            aria-label={`Somar ${metric.label} ao eixo`}
          >
            +
          </button>
        ) : null}
      </div>
    );
  };

  const panel = (
    <div className="axis-multiselect" ref={wrapRef}>
      <div
        className={`axis-multiselect-trigger${open ? " is-open" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") setOpen((current) => !current);
        }}
        aria-expanded={open}
        aria-label={axis === "x" ? "Métricas do eixo X" : "Métricas do eixo Y"}
      >
        {chips.length > 1 ? (
          <span className="axis-ms-chips">
            {chips.slice(0, 2).map((chip) => (
              <span key={chip.key} className="axis-ms-chip">
                {chip.label}
                <span
                  className="axis-ms-chip-x"
                  role="button"
                  aria-label={`Remover ${chip.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeKey(chip.key);
                  }}
                >
                  ×
                </span>
              </span>
            ))}
            {chips.length > 2 ? <span className="axis-ms-chip axis-ms-chip-more">+{chips.length - 2}</span> : null}
          </span>
        ) : (
          <span className="axis-multiselect-label">{triggerLabel}</span>
        )}
        <i className={`fa-solid fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </div>
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              className="axis-multiselect-panel is-floating"
              role="group"
              aria-label="Stats do eixo"
              style={{
                left: pos.left,
                width: pos.width,
                ...(pos.top != null ? { top: pos.top } : { bottom: pos.bottom }),
              }}
            >
              <input
                type="search"
                className="axis-ms-search"
                placeholder="Buscar stat…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
              <div className="axis-ms-list">
                {sections.map((section) => (
                  <div key={section.title} className="axis-multiselect-group">
                    <span className="axis-multiselect-group-title">{section.title}</span>
                    {section.options.map(renderOption)}
                  </div>
                ))}
                {extra.length ? (
                  <div className="axis-multiselect-group">
                    <span className="axis-multiselect-group-title">Outras métricas</span>
                    {extra.map(renderOption)}
                  </div>
                ) : null}
                {!hasAny ? <p className="axis-ms-empty">Nenhuma stat para “{query}”.</p> : null}
              </div>
              <p className="axis-multiselect-hint">Clique troca a stat · <strong>+</strong> soma no eixo</p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );

  if (bare) return panel;

  return (
    <div className="axis-picker">
      {panel}
      <button type="button" className="axis-swap" onClick={onSwap} title="Trocar eixos X e Y" aria-label="Trocar eixos X e Y">
        ⇄
      </button>
    </div>
  );
}

function metricLabel(metrics: Metric[], key: string): string {
  return metrics.find((metric) => metric.key === key)?.label ?? key;
}
