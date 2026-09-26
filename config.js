// Google Sheet connection and runtime options (SPEC §5.1).
// PUB_ID is the "2PACX-…" id from the publish link. While it or any GID is
// empty, the site runs from data/snapshot.json only.
export default {
  PUB_ID: "2PACX-1vRRddXsH-f9_qxmITpEn-XE92xonHKHADf8UK9bdlIzfhIZzI1NPdyXjKeuJSxejxey0Q0g8fh6V0OY",
  GIDS: { foglalkozasok: "307838264", foglalkozastipusok: "5661847", osztalyok: "197065871", orak: "998059591", beallitasok: "795384658" },
  TIMEOUT_MS: 8000,
  SAMPLE_BASE: "data/sample/",
  SNAPSHOT_URL: "data/snapshot.json",
};
