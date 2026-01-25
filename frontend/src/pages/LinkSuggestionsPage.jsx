import { useEffect, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE || "/api";

export default function LinkSuggestionsPage() {
  const [suggestions, setSuggestions] = useState([]);
  const [cards, setCards] = useState([]);
  const [filters, setFilters] = useState({
    q: "",
    sort_dir: "asc",
  });
  const [selectedCards, setSelectedCards] = useState([]);

  const loadSuggestions = () => {
    fetch(`${apiBase}/link-suggestions?limit=200&offset=0`)
      .then((res) => res.json())
      .then((data) => setSuggestions(data.items || []))
      .catch(() => setSuggestions([]));
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({
      q: filters.q || "",
      visibility: "normal",
      sort_by: "conversation_at",
      sort_dir: filters.sort_dir,
      limit: 50,
      offset: 0,
    });
    fetch(`${apiBase}/cards?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setCards(data.items || []))
      .catch(() => setCards([]));
  }, [filters]);

  const selectedIds = new Set(selectedCards.map((card) => card.card_id));

  const toggleCard = (card) => {
    if (selectedIds.has(card.card_id)) {
      setSelectedCards((prev) => prev.filter((item) => item.card_id !== card.card_id));
    } else {
      setSelectedCards((prev) => [...prev, card]);
    }
  };

  const handleGenerate = () => {
    if (selectedCards.length < 2) {
      return;
    }
    const cardIds = selectedCards.map((card) => card.card_id);
    fetch(`${apiBase}/link-suggestions/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_card_ids: cardIds,
        to_card_ids: cardIds,
      }),
    })
      .then(() => loadSuggestions())
      .catch(() => loadSuggestions());
  };

  const handleRerun = (suggestionId) => {
    fetch(`${apiBase}/link-suggestions/${suggestionId}/rerun`, {
      method: "POST",
    })
      .then(() => loadSuggestions())
      .catch(() => loadSuggestions());
  };

  const handleApprove = (suggestion) => {
    const payload = suggestion.suggested_link_kind_id
      ? { link_kind_id: suggestion.suggested_link_kind_id }
      : {};
    fetch(`${apiBase}/link-suggestions/${suggestion.suggestion_id}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then(() => loadSuggestions())
      .catch(() => loadSuggestions());
  };

  const handleReject = (suggestionId) => {
    fetch(`${apiBase}/link-suggestions/${suggestionId}/reject`, {
      method: "POST",
    })
      .then(() => loadSuggestions())
      .catch(() => loadSuggestions());
  };

  const visibleStatuses = new Set(["queued", "processing", "success", "failed"]);
  const visibleSuggestions = suggestions.filter((item) => visibleStatuses.has(item.status));
  const summarizeContents = (contents) => {
    if (!contents) {
      return "-";
    }
    return contents.toString().slice(0, 20);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Links</h2>
          <p className="empty">関連付け候補を確認します。</p>
        </div>
      </div>
      <div className="links-layout">
        <section className="links-panel">
          <div className="filters">
            <input
              type="text"
              placeholder="キーワード検索"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            />
            <select
              value={filters.sort_dir}
              onChange={(event) => setFilters({ ...filters, sort_dir: event.target.value })}
            >
              <option value="asc">asc</option>
              <option value="desc">desc</option>
            </select>
          </div>
          <div className="card-grid">
            {cards.length === 0 ? (
              <p className="empty">カードがありません。</p>
            ) : (
              cards.map((card) => (
                <button
                  key={card.card_id}
                  type="button"
                  className={`card card-button${selectedIds.has(card.card_id) ? " card-selected" : ""}`}
                  onClick={() => toggleCard(card)}
                >
                  <div className="card-row">
                    <div className="card-summary">
                      <span className="card-summary-label">
                        {card.speaker_name || "-"}：
                      </span>
                      <span className="card-summary-text">{card.contents || ""}</span>
                    </div>
                    <span className="card-role">{card.card_role_name || "未設定"}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
        <section className="links-panel">
          <div className="links-panel-header">
            <h3 className="panel-title">選択中のカード</h3>
            <button
              type="button"
              className="primary"
              onClick={handleGenerate}
              disabled={selectedCards.length < 2}
            >
              関連付け
            </button>
          </div>
          <div className="card-grid">
            {selectedCards.length === 0 ? (
              <p className="empty">カードを選択してください。</p>
            ) : (
              selectedCards.map((card) => (
                <button
                  key={card.card_id}
                  type="button"
                  className="card card-button card-highlight"
                  onClick={() => toggleCard(card)}
                >
                  <div className="card-row">
                    <div className="card-summary">
                      <span className="card-summary-label">
                        {card.speaker_name || "-"}：
                      </span>
                      <span className="card-summary-text">{card.contents || ""}</span>
                    </div>
                    <span className="card-role">{card.card_role_name || "未設定"}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
      <div className="section">
        <h3>関連付け候補一覧</h3>
        {visibleSuggestions.length === 0 ? (
          <p className="empty">候補がありません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>from</th>
                <th>to</th>
                <th>existing</th>
                <th>status</th>
                <th>suggested</th>
                <th>actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleSuggestions.map((item) => (
                <tr key={item.suggestion_id}>
                  <td>
                    {summarizeContents(item.from_card_contents)}
                  </td>
                  <td>
                    {summarizeContents(item.to_card_contents)}
                  </td>
                  <td>
                    {item.existing_link_kind_name
                      ? `${item.existing_link_kind_name} (${item.existing_link_confidence ?? "-"})`
                      : "-"}
                  </td>
                  <td>{item.status}</td>
                  <td>
                    {item.suggested_link_kind_name || "-"} (
                    {item.suggested_confidence ?? "-"})
                  </td>
                  <td>
                    <div className="inline-actions">
                      {item.status === "failed" && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleRerun(item.suggestion_id)}
                        >
                          再実行
                        </button>
                      )}
                      {item.status === "success" && (
                        <>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handleApprove(item)}
                          >
                            承認
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handleReject(item.suggestion_id)}
                          >
                            却下
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}