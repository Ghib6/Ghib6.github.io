(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vendor/diff-9.0.0.min.js'));
  else root.ArticleDiff = factory(root.Diff);
}(typeof window === 'object' ? window : this, function (engine) {
  'use strict';
  function lines(value) { var result = value.split('\n'); if (result[result.length - 1] === '') result.pop(); return result; }
  function build(original, proposed) {
    if (!engine) return null;
    var parts = engine.diffLines(original, proposed, { stripTrailingCr: true, timeout: 120 });
    if (!parts) return null;
    var rows = [], groups = [], oldLine = 1, newLine = 1, added = 0, removed = 0;
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part.added && !part.removed) {
        lines(part.value).forEach(function (text) { rows.push({ left: text, right: text, oldLine: oldLine++, newLine: newLine++, changed: false }); });
        continue;
      }
      var deleted = [], inserted = [];
      while (i < parts.length && (parts[i].added || parts[i].removed)) {
        if (parts[i].removed) deleted = deleted.concat(lines(parts[i].value));
        else inserted = inserted.concat(lines(parts[i].value));
        i++;
      }
      i--; added += inserted.length; removed += deleted.length;
      var group = groups.length; groups.push(rows.length);
      for (var j = 0; j < Math.max(deleted.length, inserted.length); j++) {
        rows.push({ left: j < deleted.length ? deleted[j] : null, right: j < inserted.length ? inserted[j] : null, oldLine: j < deleted.length ? oldLine++ : null, newLine: j < inserted.length ? newLine++ : null, changed: true, group: group, first: j === 0 });
      }
    }
    return { rows: rows, groups: groups, added: added, removed: removed };
  }
  function visible(rows, expanded) {
    if (expanded) return rows;
    var keep = new Set();
    rows.forEach(function (row, index) { if (row.changed) for (var i = Math.max(0, index - 3); i <= Math.min(rows.length - 1, index + 3); i++) keep.add(i); });
    var result = [], skipped = 0;
    rows.forEach(function (row, index) {
      if (!keep.has(index)) { skipped++; return; }
      if (skipped) { result.push({ gap: skipped }); skipped = 0; }
      result.push(row);
    });
    if (skipped) result.push({ gap: skipped });
    return result;
  }
  return { build: build, visible: visible };
}));
