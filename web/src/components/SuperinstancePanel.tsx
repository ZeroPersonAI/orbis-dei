import { useEffect, useState } from "react";
import { api, type LoopEventRow } from "../lib/tauri-bindings";
import { useT } from "../lib/i18n";

interface Props {
  instanceId: string;
  refreshTick: number;
}

export function SuperinstancePanel({ instanceId, refreshTick }: Props) {
  const { t } = useT();
  const [content, setContent] = useState<string>("");
  const [events, setEvents] = useState<LoopEventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.readSuperinstance(instanceId),
      api.loopEventsForInstance(instanceId),
    ])
      .then(([c, ev]) => {
        if (!cancelled) {
          setContent(c);
          setEvents(ev);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [instanceId, refreshTick]);

  if (error) {
    return <div className="text-sm text-red-300">{error}</div>;
  }

  // A loop is "complete" if it has an integrate event with outcome ok.
  const integrateOk = events.filter(
    (e) => e.phase === "integrate" && e.outcome === "ok",
  ).length;
  const failed = events.filter(
    (e) => e.outcome && e.outcome.startsWith("failed"),
  ).length;

  return (
    <div>
      <div className="text-xs text-neutral-500 mb-3">
        {t("loop events:")} {events.length} · {t("integrate-ok:")} {integrateOk}{" "}
        · {t("failed phases:")} {failed}
      </div>
      <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
        {content || t("(empty)")}
      </pre>
    </div>
  );
}
