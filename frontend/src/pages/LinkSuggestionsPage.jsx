import { useEffect, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE || "/api";

export default function LinkSuggestionsPage() {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    fetch(`${apiBase}/link-suggestions?limit=20&offset=0`)
      .then((res) => res.json())
      .then((data) => setSuggestions(data.items || []))
      .catch(() => setSuggestions([]));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Links</h2>
          <p className="empty">関連付け候補を確認します。</p>
        </div>
      </div>
      {suggestions.length === 0 ? (
        <p className="empty">候補がありません。</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>from</th>
              <th>to</th>
              <th>status</th>
              <th>suggested</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((item) => (
              <tr key={item.suggestion_id}>
                <td>{item.from_card_id}</td>
                <td>{item.to_card_id}</td>
                <td>{item.status}</td>
                <td>
                  {item.suggested_link_kind_name || "-"} ({item.suggested_confidence ?? "-"})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}