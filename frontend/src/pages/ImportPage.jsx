import { useEffect, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE || "/api";

export default function ImportPage() {
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");

  const getRowCount = (value) => Math.max(1, value.split("\n").length);
  const resizeTextarea = (element) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  const renumberTextIds = (parts, messageId) => {
    let counter = 1;
    return parts.map((part) => {
      if (part.message_id !== messageId) {
        return part;
      }
      const updated = { ...part, text_id: counter };
      counter += 1;
      return updated;
    });
  };

  const handlePreview = async () => {
    setMessage("");
    const res = await fetch(`${apiBase}/import/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_text: rawText,
      }),
    });
    if (!res.ok) {
      setMessage("プレビューに失敗しました");
      return;
    }
    const data = await res.json();
    setPreview(data);
  };

  const handleCommit = async () => {
    if (!preview) return;
    const res = await fetch(`${apiBase}/import/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thread_id: preview.thread_id,
        parts: preview.parts,
      }),
    });
    if (!res.ok) {
      setMessage("保存に失敗しました");
      return;
    }
    const data = await res.json();
    setMessage(`保存完了: ${data.created_card_ids.length}件`);
    setRawText("");
    setPreview(null);
  };

  const handleContentsChange = (index, value) => {
    setPreview((current) => {
      if (!current) return current;
      const nextParts = current.parts.map((part, partIndex) =>
        partIndex === index ? { ...part, contents: value } : part
      );
      return { ...current, parts: nextParts };
    });
  };

  const handleMergeUp = (index) => {
    setPreview((current) => {
      if (!current) return current;
      const parts = [...current.parts];
      const target = parts[index];
      if (!target) return current;
      const { message_id: messageId } = target;
      let previousIndex = -1;
      for (let i = index - 1; i >= 0; i -= 1) {
        if (parts[i].message_id === messageId) {
          previousIndex = i;
          break;
        }
      }
      if (previousIndex === -1) return current;
      const previous = parts[previousIndex];
      const merged = {
        ...previous,
        contents: `${previous.contents}\n${target.contents}`,
      };
      parts.splice(previousIndex, 1, merged);
      parts.splice(index, 1);
      const renumbered = renumberTextIds(parts, messageId);
      return { ...current, parts: renumbered };
    });
  };

  const handleSplitDown = (index) => {
    setPreview((current) => {
      if (!current) return current;
      const parts = [...current.parts];
      const target = parts[index];
      if (!target) return current;
      const { message_id: messageId } = target;
      const duplicate = { ...target };
      parts.splice(index + 1, 0, duplicate);
      const renumbered = renumberTextIds(parts, messageId);
      return { ...current, parts: renumbered };
    });
  };

  useEffect(() => {
    document.querySelectorAll(".preview-textarea").forEach(resizeTextarea);
  }, [preview]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Import</h2>
          <p className="empty">テキストを貼り付けてカード化します。</p>
        </div>
      </div>
      <div className="card">
        <textarea
          rows={8}
          style={{ width: "100%", marginTop: "12px" }}
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
        />
        <div className="section inline-actions">
          <button className="primary" onClick={handlePreview}>
            プレビュー
          </button>
          <button className="secondary" onClick={handleCommit} disabled={!preview}>
            保存
          </button>
        </div>
        {message && <p className="empty">{message}</p>}
      </div>
      {preview && (
        <div className="section">
          <h3>プレビュー</h3>
          <div className="preview-card-grid">
            {preview.parts.map((part, index) => {
              const {
                message_id: messageId,
                text_id: textId,
                speaker_name: speakerName,
                contents,
              } = part;
              const hasPreviousSameMessage = preview.parts
                .slice(0, index)
                .some((item) => item.message_id === messageId);
              const showDivider =
                index > 0 &&
                preview.parts[index - 1].message_id !== messageId;
              return (
                <div key={`${messageId}-${textId}-${index}`}>
                  {showDivider && <div className="preview-divider" />}
                  <div className="preview-card">
                    <div className="preview-header">
                      <div className="preview-contents">
                        <div className="card-title">
                          {speakerName}
                        </div>
                        <div className="card-body">
                          <textarea
                            className="preview-textarea"
                            rows={getRowCount(contents)}
                            value={contents}
                            onChange={(event) =>
                              handleContentsChange(index, event.target.value)
                            }
                            onInput={(event) => resizeTextarea(event.target)}
                          />
                        </div>
                      </div>
                      <div className="preview-actions">
                          <button
                            className="secondary"
                            type="button"
                            onClick={() => handleMergeUp(index)}
                          >
                            上に統合
                          </button>
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => handleSplitDown(index)}
                        >
                          下に分割
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}