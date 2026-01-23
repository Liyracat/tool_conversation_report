import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const apiBase = import.meta.env.VITE_API_BASE || "/api";

export default function CardDetailPage() {
  const { cardId } = useParams();
  const [card, setCard] = useState(null);
  const [context, setContext] = useState({ items: [] });
  const [contextEdits, setContextEdits] = useState([]);
  const [contextMerges, setContextMerges] = useState([]);
  const [contextSplits, setContextSplits] = useState([]);
  const [links, setLinks] = useState([]);
  const [detailForm, setDetailForm] = useState(null);
  const [saveState, setSaveState] = useState({ status: "idle", message: "" });
  const [contextSaveState, setContextSaveState] = useState({
    status: "idle",
    message: "",
  });
  const getRowCount = (value) => Math.max(1, value.split("\n").length);
  const resizeTextarea = (element) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    const loadCard = async () => {
      if (!cardId) return;
      try {
        const res = await fetch(`${apiBase}/cards/${cardId}`);
        const data = await res.json();
        setCard(data.card);
        setContext(data.context_messages || { items: [] });
        setContextEdits(
          (data.context_messages?.items || []).map((item) => ({
            ...item,
            localId: `card-${item.card_id}`,
            originalContents: item.contents,
          }))
        );
        setContextMerges([]);
        setContextSplits([]);
        setContextSaveState({ status: "idle", message: "" });
        setDetailForm({
          thread_id: data.card?.thread_id ?? "",
          message_id: data.card?.message_id ?? "",
          text_id: data.card?.text_id ?? "",
          split_key: data.card?.split_key ?? "",
          split_version: data.card?.split_version ?? "",
          speaker_id: data.card?.speaker_id ?? "",
          conversation_at: data.card?.conversation_at ?? "",
          contents: data.card?.contents ?? "",
          is_edited: data.card?.is_edited ?? "",
          card_role_id: data.card?.card_role_id ?? "",
          card_role_confidence: data.card?.card_role_confidence ?? "",
          visibility: data.card?.visibility ?? "",
          created_at: data.card?.created_at ?? "",
          updated_at: data.card?.updated_at ?? "",
        });
      } catch (error) {
        setCard(null);
        setContext({ items: [] });
        setContextEdits([]);
        setContextMerges([]);
        setContextSplits([]);
        setDetailForm(null);
      }
    };

    const loadLinks = async () => {
      if (!cardId) return;
      try {
        const res = await fetch(`${apiBase}/cards/${cardId}/links`);
        const data = await res.json();
        setLinks(data.items || []);
      } catch (error) {
        setLinks([]);
      }
    };

    loadCard();
    loadLinks();
  }, [cardId]);

  useEffect(() => {
    document.querySelectorAll(".context-textarea").forEach(resizeTextarea);
  }, [contextEdits]);

  if (!card) {
    return <p className="empty">カード詳細を読み込み中...</p>;
  }

  const minTextIdByMessage = contextEdits.reduce((acc, item) => {
    const current = acc[item.message_id];
    if (current === undefined || item.text_id < current) {
      acc[item.message_id] = item.text_id;
    }
    return acc;
  }, {});

  const handleDetailChange = (field, value) => {
    setDetailForm((prev) => ({ ...prev, [field]: value }));
  };

  const toNullableNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const handleSave = async () => {
    if (!detailForm) return;
    setSaveState({ status: "saving", message: "" });
    const payload = {
      thread_id: detailForm.thread_id || null,
      message_id: toNullableNumber(detailForm.message_id),
      text_id: toNullableNumber(detailForm.text_id),
      split_key: toNullableNumber(detailForm.split_key),
      split_version: toNullableNumber(detailForm.split_version),
      speaker_id: toNullableNumber(detailForm.speaker_id),
      conversation_at: detailForm.conversation_at || null,
      contents: detailForm.contents ?? "",
      is_edited: toNullableNumber(detailForm.is_edited),
      card_role_id: toNullableNumber(detailForm.card_role_id),
      card_role_confidence: toNullableNumber(detailForm.card_role_confidence),
      visibility: detailForm.visibility || null,
      created_at: detailForm.created_at || null,
      updated_at: detailForm.updated_at || null,
    };

    try {
      const res = await fetch(`${apiBase}/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error("Failed to save");
      }
      const refresh = await fetch(`${apiBase}/cards/${cardId}`);
      const data = await refresh.json();
      setCard(data.card);
      setContext(data.context_messages || { items: [] });
      setDetailForm({
        thread_id: data.card?.thread_id ?? "",
        message_id: data.card?.message_id ?? "",
        text_id: data.card?.text_id ?? "",
        split_key: data.card?.split_key ?? "",
        split_version: data.card?.split_version ?? "",
        speaker_id: data.card?.speaker_id ?? "",
        conversation_at: data.card?.conversation_at ?? "",
        contents: data.card?.contents ?? "",
        is_edited: data.card?.is_edited ?? "",
        card_role_id: data.card?.card_role_id ?? "",
        card_role_confidence: data.card?.card_role_confidence ?? "",
        visibility: data.card?.visibility ?? "",
        created_at: data.card?.created_at ?? "",
        updated_at: data.card?.updated_at ?? "",
      });
      setSaveState({ status: "success", message: "保存しました。" });
    } catch (error) {
      setSaveState({ status: "error", message: "保存に失敗しました。" });
    }
  };

  const handleContextContentChange = (localId, value) => {
    setContextEdits((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, contents: value } : item
      )
    );
  };

  const findPreviousIndex = (items, index) => {
    const current = items[index];
    if (!current) return -1;
    for (let i = index - 1; i >= 0; i -= 1) {
      if (items[i].message_id === current.message_id) {
        return i;
      }
    }
    return -1;
  };

  const handleMergeUp = (index) => {
    setContextEdits((prev) => {
      const next = [...prev];
      const previousIndex = findPreviousIndex(next, index);
      if (previousIndex < 0) return prev;
      const source = next[index];
      const target = next[previousIndex];
      const mergedContents = `${target.contents}\n${source.contents}`;
      next[previousIndex] = { ...target, contents: mergedContents };
      next.splice(index, 1);
      if (source.card_id && target.card_id) {
        setContextMerges((current) => [
          ...current,
          { source_card_id: source.card_id, target_card_id: target.card_id },
        ]);
      }
      return next;
    });
  };

  const handleSplitDown = (index) => {
    setContextEdits((prev) => {
      const next = [...prev];
      const source = next[index];
      if (!source?.card_id) return prev;
      const maxTextId = Math.max(
        ...next
          .filter((item) => item.message_id === source.message_id)
          .map((item) => item.text_id)
      );
      const newItem = {
        ...source,
        card_id: null,
        text_id: maxTextId + 1,
        localId: `split-${Date.now()}-${Math.random()}`,
        originalContents: source.contents,
        splitSourceCardId: source.card_id,
      };
      next.splice(index + 1, 0, newItem);
      setContextSplits((current) => [
        ...current,
        { source_card_id: source.card_id, temp_id: newItem.localId },
      ]);
      return next;
    });
  };

  const handleContextSave = async () => {
    setContextSaveState({ status: "saving", message: "" });
    const editedItems = contextEdits
      .filter(
        (item) =>
          item.card_id &&
          item.contents !== item.originalContents
      )
      .map((item) => ({ card_id: item.card_id, contents: item.contents }));
    const splitItems = contextSplits.flatMap((split) => {
      const splitTarget = contextEdits.find(
        (item) => item.localId === split.temp_id
      );
      if (!splitTarget) return [];
      return [
        {
          source_card_id: split.source_card_id,
          contents: splitTarget.contents ?? "",
          temp_id: split.temp_id,
        },
      ];
    });
    const orderItems = contextEdits.map((item) => ({
      message_id: item.message_id,
      card_id: item.card_id ?? null,
      temp_id: item.card_id ? null : item.localId,
    }));
    try {
      const res = await fetch(`${apiBase}/cards/context:save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: editedItems,
          merges: contextMerges,
          splits: splitItems,
          order: orderItems,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "保存に失敗しました。");
      }
      const refresh = await fetch(`${apiBase}/cards/${cardId}`);
      const data = await refresh.json();
      setCard(data.card);
      setContext(data.context_messages || { items: [] });
      setContextEdits(
        (data.context_messages?.items || []).map((item) => ({
          ...item,
          localId: `card-${item.card_id}`,
          originalContents: item.contents,
        }))
      );
      setContextMerges([]);
      setContextSplits([]);
      setContextSaveState({ status: "success", message: "保存しました。" });
    } catch (error) {
      setContextSaveState({
        status: "error",
        message: error.message || "保存に失敗しました。",
      });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>カード詳細</h2>
          <p className="empty">Card ID: {card.card_id}</p>
        </div>
        <Link to="/">一覧へ戻る</Link>
      </div>
      <div className="card">
        <div className="card-row">
          <div className="card-summary">
            <span className="card-summary-label">
              {card.speaker_name || "-"}：
            </span>
            <span className="card-summary-text">{card.contents || ""}</span>
          </div>
          <span className="card-role">{card.card_role_name || "未設定"}</span>
        </div>
      </div>

      <div className="section">
        <details className="accordion" close>
          <summary>前後メッセージ</summary>
          <div className="accordion-body">
            {contextEdits.length === 0 ? (
              <p className="empty">前後メッセージがありません。</p>
            ) : (
              <div className="card-grid">
                {contextEdits.map((item, index) => {
                  const showDivider =
                    index > 0 &&
                    contextEdits[index - 1].message_id !== item.message_id;
                  const isFirstInMessage =
                    minTextIdByMessage[item.message_id] === item.text_id;
                  const previousIndex = findPreviousIndex(contextEdits, index);
                  const previousItem =
                    previousIndex >= 0 ? contextEdits[previousIndex] : null;
                  const canMerge = Boolean(
                    previousItem?.card_id && item.card_id
                  );
                  return (
                    <div key={item.localId} className="context-card-wrapper">
                      {showDivider && <div className="preview-divider" />}
                      <div
                        className={`card${
                          item.card_id === card.card_id ? " card-highlight" : ""
                        }`}
                      >
                        <div className="context-card-row">
                          <div className="context-content">
                            <span className="card-title">
                              {item.speaker_name || "-"}：
                            </span>
                            <textarea
                              className="form-textarea context-textarea"
                              rows={getRowCount(item.contents ?? "")}
                              value={item.contents ?? ""}
                              onChange={(event) =>
                                handleContextContentChange(
                                  item.localId,
                                  event.target.value
                                )
                              }
                              onInput={(event) => resizeTextarea(event.target)}
                            />
                          </div>
                          <div className="context-meta">
                            <span className="card-role">
                              {item.card_role_name || "未設定"}
                            </span>
                            <div className="context-actions">
                              <button
                                type="button"
                                onClick={() => handleMergeUp(index)}
                                disabled={!canMerge}
                              >
                                上に結合
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSplitDown(index)}
                                disabled={!item.card_id}
                              >
                                下に分割
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {contextEdits.length > 0 && (
              <div className="inline-actions">
                <button
                  className="primary"
                  type="button"
                  onClick={handleContextSave}
                  disabled={contextSaveState.status === "saving"}
                >
                  保存
                </button>
                {contextSaveState.message && (
                  <span className="empty">{contextSaveState.message}</span>
                )}
              </div>
            )}
          </div>
        </details>
      </div>

      <div className="section">
        <details className="accordion" close>
          <summary>詳細</summary>
          <div className="accordion-body">
            <div className="settings-form">
              <div className="form-row">
                <label className="form-field">
                  thread_id
                  <input
                    className="form-input"
                    value={detailForm?.thread_id ?? ""}
                    onChange={(event) =>
                      handleDetailChange("thread_id", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  message_id
                  <input
                    className="form-input"
                    type="number"
                    value={detailForm?.message_id ?? ""}
                    onChange={(event) =>
                      handleDetailChange("message_id", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  text_id
                  <input
                    className="form-input"
                    type="number"
                    value={detailForm?.text_id ?? ""}
                    onChange={(event) =>
                      handleDetailChange("text_id", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  split_key
                  <input
                    className="form-input"
                    type="number"
                    value={detailForm?.split_key ?? ""}
                    onChange={(event) =>
                      handleDetailChange("split_key", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  split_version
                  <input
                    className="form-input"
                    type="number"
                    value={detailForm?.split_version ?? ""}
                    onChange={(event) =>
                      handleDetailChange("split_version", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  speaker_id
                  <input
                    className="form-input"
                    type="number"
                    value={detailForm?.speaker_id ?? ""}
                    onChange={(event) =>
                      handleDetailChange("speaker_id", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  conversation_at
                  <input
                    className="form-input"
                    value={detailForm?.conversation_at ?? ""}
                    onChange={(event) =>
                      handleDetailChange("conversation_at", event.target.value)
                    }
                  />
                </label>
                <label className="form-field form-field-wide">
                  contents
                  <textarea
                    className="form-textarea"
                    value={detailForm?.contents ?? ""}
                    onChange={(event) =>
                      handleDetailChange("contents", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  is_edit
                  <input
                    className="form-input"
                    type="number"
                    value={detailForm?.is_edited ?? ""}
                    onChange={(event) =>
                      handleDetailChange("is_edited", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  card_role_id
                  <input
                    className="form-input"
                    type="number"
                    value={detailForm?.card_role_id ?? ""}
                    onChange={(event) =>
                      handleDetailChange("card_role_id", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  card_role_confidence
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={detailForm?.card_role_confidence ?? ""}
                    onChange={(event) =>
                      handleDetailChange("card_role_confidence", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  visibility
                  <input
                    className="form-input"
                    value={detailForm?.visibility ?? ""}
                    onChange={(event) =>
                      handleDetailChange("visibility", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  created_at
                  <input
                    className="form-input"
                    value={detailForm?.created_at ?? ""}
                    onChange={(event) =>
                      handleDetailChange("created_at", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  updated_at
                  <input
                    className="form-input"
                    value={detailForm?.updated_at ?? ""}
                    onChange={(event) =>
                      handleDetailChange("updated_at", event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="inline-actions">
                <button
                  className="primary"
                  type="button"
                  onClick={handleSave}
                  disabled={saveState.status === "saving"}
                >
                  保存
                </button>
                {saveState.message && (
                  <span className="empty">{saveState.message}</span>
                )}
              </div>
            </div>
          </div>
        </details>
      </div>

      <div className="section">
        <h3>関連カード</h3>
        {links.length === 0 ? (
          <p className="empty">関連カードがありません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>種別</th>
                <th>内容</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.link_id}>
                  <td>{link.link_kind_name}</td>
                  <td>{link.to_card?.contents}</td>
                  <td>{link.confidence ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}