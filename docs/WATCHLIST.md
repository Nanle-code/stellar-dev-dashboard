# Watchlist summary

The Overview watchlist widget is local-first and network-scoped. Watched account
labels and the last-seen timestamp are stored in the browser's local storage;
secret keys and transaction signing material are never stored by this feature.

The widget compares the latest account snapshot with the preceding snapshot and
shows balance deltas. `Mark all seen` records a timestamp for the active network
so switching networks cannot silently mark another network's changes as read.
Accounts are fetched with the existing bounded-concurrency watcher. A failed
account refresh is displayed as an error in the watcher and does not prevent
other accounts from updating.
