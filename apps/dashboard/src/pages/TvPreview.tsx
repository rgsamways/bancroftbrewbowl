import { useNavigate, useParams } from "react-router";
import { TvPlayer } from "./TvPlayer";

/** An admin's preview of a screen or a playlist: the same player a TV runs, full-screen, fed from
 * the admin-only preview routes, with a Close button. Shows the saved playlist and writes nothing. */
export function TvPreview({ of }: { of: "screens" | "playlists" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const close = () => (window.history.length > 1 ? navigate(-1) : navigate("/admin/tv"));
  return <TvPlayer feedPath={`/tv/${of}/${encodeURIComponent(id ?? "")}/preview`} onClose={close} />;
}
