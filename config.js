// Google Sheet connection and runtime options (SPEC §5.1).
// PUB_ID is the "2PACX-…" id from the publish link. While it or any GID is
// empty, the site runs from data/snapshot.json only.
export default {
  PUB_ID: "",
  GIDS: { foglalkozasok: "", foglalkozastipusok: "", osztalyok: "", orak: "", beallitasok: "" },
  TIMEOUT_MS: 8000,
  SAMPLE_BASE: "data/sample/",
  SNAPSHOT_URL: "data/snapshot.json",
};
