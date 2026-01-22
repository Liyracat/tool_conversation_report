import { useEffect, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE || "/api";

export default function SettingsPage() {
  const [speakers, setSpeakers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [linkKinds, setLinkKinds] = useState([]);

  useEffect(() => {
    fetch(`${apiBase}/speakers`)
      .then((res) => res.json())
      .then((data) => setSpeakers(data))
      .catch(() => setSpeakers([]));
    fetch(`${apiBase}/card-roles`)
      .then((res) => res.json())
      .then((data) => setRoles(data))
      .catch(() => setRoles([]));
    fetch(`${apiBase}/link-kinds`)
      .then((res) => res.json())
      .then((data) => setLinkKinds(data))
      .catch(() => setLinkKinds([]));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p className="empty">基本設定データを確認します。</p>
        </div>
      </div>
      <div className="section">
        <h3>Speakers</h3>
        {speakers.length === 0 ? (
          <p className="empty">登録されていません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Canonical</th>
              </tr>
            </thead>
            <tbody>
              {speakers.map((speaker) => (
                <tr key={speaker.speaker_id}>
                  <td>{speaker.speaker_id}</td>
                  <td>{speaker.speaker_name}</td>
                  <td>{speaker.speaker_role}</td>
                  <td>{speaker.canonical_role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="section">
        <h3>Card Roles</h3>
        {roles.length === 0 ? (
          <p className="empty">登録されていません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Major ID</th>
                <th>Minor Name</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.card_role_id}>
                  <td>{role.card_role_id}</td>
                  <td>{role.card_role_major_item_id}</td>
                  <td>{role.minor_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="section">
        <h3>Link Kinds</h3>
        {linkKinds.length === 0 ? (
          <p className="empty">登録されていません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {linkKinds.map((kind) => (
                <tr key={kind.link_kind_id}>
                  <td>{kind.link_kind_id}</td>
                  <td>{kind.link_kind_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}