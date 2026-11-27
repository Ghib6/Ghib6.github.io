(function () {
  "use strict";

  var ADMIN_PATH_PREFIX = "/admin";
  var API_BASE = "https://blog-cms-oauth-dusky.vercel.app/api";
  var UPLOAD_ENDPOINT = API_BASE + "/upload";
  var MEDIA_LIST_ENDPOINT = API_BASE + "/media/list";
  var MEDIA_DELETE_ENDPOINT = API_BASE + "/media/delete";
  var MEDIA_RENAME_ENDPOINT = API_BASE + "/media/rename";
  var MEDIA_CATEGORIES_ENDPOINT = API_BASE + "/media/categories";
  var SECRET_STORAGE_KEY = "picbedUploadSecret";
  var DOCK_WIDTH_STORAGE_KEY = "picbedDockWidth";
  var MAX_FILES_PER_UPLOAD = 15;
  var DEFAULT_UPLOAD_CATEGORY = "posts";
  var DEFAULT_LIBRARY_CATEGORY = "all";

  function isAdminPage() {
    return window.location.pathname.indexOf(ADMIN_PATH_PREFIX) === 0;
  }

  function safeWarn(message, error) {
    try {
      console.warn("[picbed-manage] " + message, error || "");
    } catch (e) {
      // ignore
    }
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatSize(size) {
    var n = Number(size || 0);
    if (!n || n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
  }

  function filenameWithoutExt(name) {
    var text = String(name || "").trim();
    if (!text) return "image";
    return text.replace(/\.[^.]+$/, "") || text;
  }

  function createUI() {
    if (!isAdminPage() || document.getElementById("picbed-insert-fab")) return;

    var style = document.createElement("style");
    style.textContent = ""
      + "#picbed-insert-fab{position:fixed;right:20px;bottom:20px;z-index:1000;background:#fff;color:#111;border:1px solid #ddd;box-shadow:0 2px 8px rgba(0,0,0,.12);padding:8px 12px;border-radius:6px;cursor:pointer;font-size:14px;}"
      + "#picbed-dock-panel{position:fixed;right:20px;top:90px;bottom:20px;width:min(420px,94vw);background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.14);z-index:1001;display:none;flex-direction:column;padding:14px;font-size:14px;color:#111;}"
      + "#picbed-dock-resizer{position:absolute;left:0;top:0;bottom:0;width:6px;cursor:ew-resize;z-index:2;}"
      + "#picbed-dock-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;}"
      + "#picbed-dock-header h3{margin:0;font-size:16px;}"
      + "#picbed-dock-status{font-size:12px;color:#666;background:#f6f6f6;border:1px solid #e6e6e6;border-radius:12px;padding:2px 8px;}"
      + "#picbed-tabs{display:flex;gap:8px;margin-bottom:10px;}"
      + "#picbed-tabs button{background:#fff;color:#111;border:1px solid #ddd;padding:6px 10px;border-radius:4px;cursor:pointer;}"
      + "#picbed-tabs button.active{background:#111;color:#fff;border-color:#111;}"
      + "#picbed-tab-panels{overflow:auto;}"
      + ".picbed-panel{display:none;}"
      + ".picbed-panel.active{display:block;}"
      + ".picbed-row{margin:8px 0;}"
      + "#picbed-dock-panel input[type='text'],#picbed-dock-panel input[type='file']{width:100%;box-sizing:border-box;padding:7px;border:1px solid #d9d9d9;border-radius:4px;}"
      + "#picbed-dock-panel .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}"
      + "#picbed-dock-panel button{background:#111;color:#fff;border:1px solid #111;padding:6px 10px;border-radius:4px;cursor:pointer;}"
      + "#picbed-dock-panel button.ghost{background:#fff;color:#111;border:1px solid #ddd;}"
      + "#picbed-dock-panel button[disabled]{opacity:.55;cursor:not-allowed;}"
      + "#picbed-upload-preview img{max-width:100%;max-height:220px;border:1px solid #eee;border-radius:4px;}"
      + "#picbed-library-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;}"
      + "#picbed-library-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;}"
      + ".picbed-card{border:1px solid #e5e5e5;border-radius:6px;padding:8px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.05);}"
      + ".picbed-card.dragging{opacity:.65;outline:2px dashed #666;}"
      + ".picbed-thumb{width:100%;height:120px;object-fit:cover;background:#f6f6f6;border-radius:4px;border:1px solid #eee;}"
      + ".picbed-meta{margin-top:6px;word-break:break-all;}"
      + ".picbed-card-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;}"
      + "#picbed-upload-status,#picbed-library-status{margin-top:10px;line-height:1.5;word-break:break-all;}"
      + "#picbed-tab-panels{overflow:auto;flex:1;min-height:0;}";
    document.head.appendChild(style);

    var fab = document.createElement("button");
    fab.id = "picbed-insert-fab";
    fab.type = "button";
    fab.setAttribute("tabindex", "-1");
    fab.textContent = "图床管理";

    var dockPanel = document.createElement("div");
    dockPanel.id = "picbed-dock-panel";
    dockPanel.innerHTML = ""
      + "<div id='picbed-dock-resizer'></div>"
      + "<div id='picbed-dock-header'><h3>图床管理</h3><span id='picbed-dock-status'>Dock 模式</span><button type='button' id='picbed-dock-close-btn' class='ghost'>关闭</button></div>"
      + "<div id='picbed-secret-section' class='picbed-row' style='border:1px solid #eee;padding:10px;border-radius:6px;'>"
      + "<div style='margin-bottom:6px;'>请输入图床管理密钥</div>"
      + "<div style='display:flex;gap:8px;flex-wrap:wrap;'>"
      + "<input id='picbed-secret-input' type='password' placeholder='请输入 X-Upload-Secret' style='flex:1;min-width:220px;' />"
      + "<button type='button' id='picbed-secret-save-btn'>保存密钥</button>"
      + "<button type='button' id='picbed-secret-clear-btn' class='ghost'>清除密钥</button>"
      + "</div>"
      + "<div id='picbed-secret-status' style='margin-top:6px;color:#666;'></div>"
      + "</div>"
      + "<div id='picbed-tabs'>"
      + "<button type='button' id='picbed-tab-upload' class='active'>上传图片</button>"
      + "<button type='button' id='picbed-tab-library' class='ghost'>图片库</button>"
      + "</div>"
      + "<div id='picbed-tab-panels'>"
      + "<div id='picbed-panel-upload' class='picbed-panel active'>"
      + "<div class='picbed-row'><input id='picbed-file' type='file' accept='image/*' multiple /></div>"
      + "<div class='picbed-row'><input id='picbed-alt' type='text' placeholder='图片说明（可选）' /></div>"
      + "<div class='picbed-row'>上传到：<select id='picbed-upload-category' style='margin-left:8px;padding:6px;border:1px solid #d9d9d9;border-radius:4px;'></select></div>"
      + "<div class='actions'>"
      + "<button type='button' id='picbed-upload-btn'>上传</button>"
      + "<button type='button' id='picbed-view-library-btn' class='ghost' style='display:none;'>查看图片库</button>"
      + "</div>"
      + "<div id='picbed-upload-preview'></div>"
      + "<div id='picbed-upload-status'></div>"
      + "</div>"
      + "<div id='picbed-panel-library' class='picbed-panel'>"
      + "<div class='picbed-row' style='color:#666;'>提示：可将图片拖拽到正文编辑区插入 Markdown。</div>"
      + "<div id='picbed-library-toolbar'>"
      + "<input id='picbed-search-input' type='text' placeholder='搜索文件名关键词' style='flex:1;min-width:220px;' />"
      + "<label for='picbed-library-category'>查看：</label><select id='picbed-library-category' style='padding:6px;border:1px solid #d9d9d9;border-radius:4px;'></select>"
      + "<button type='button' id='picbed-search-btn'>搜索</button>"
      + "<button type='button' id='picbed-refresh-btn' class='ghost'>刷新</button>"
      + "<button type='button' id='picbed-manage-categories-btn' class='ghost'>管理分类</button>"
      + "</div>"
      + "<div id='picbed-category-manager' style='display:none;border:1px solid #eee;border-radius:6px;padding:10px;margin-bottom:10px;'>"
      + "<div style='font-weight:600;margin-bottom:6px;'>分类管理</div>"
      + "<div style='display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;'><input id='picbed-new-category-id' type='text' placeholder='分类 id（如 notes）' style='flex:1;min-width:160px;' /><input id='picbed-new-category-name' type='text' placeholder='分类名称（如 笔记配图）' style='flex:1;min-width:160px;' /><button type='button' id='picbed-add-category-btn'>新增分类</button></div>"
      + "<div id='picbed-category-manager-status' style='margin-bottom:8px;color:#666;'></div>"
      + "<div id='picbed-category-manager-list'></div>"
      + "</div>"
      + "<div id='picbed-library-status'></div>"
      + "<div id='picbed-library-grid'></div>"
      + "</div>"
      + "</div>";

    document.body.appendChild(fab);
    document.body.appendChild(dockPanel);

    var fileInput = document.getElementById("picbed-file");
    var altInput = document.getElementById("picbed-alt");
    var uploadCategorySelect = document.getElementById("picbed-upload-category");
    var uploadBtn = document.getElementById("picbed-upload-btn");
    var dockCloseBtn = document.getElementById("picbed-dock-close-btn");
    var dockResizer = document.getElementById("picbed-dock-resizer");
    var viewLibraryBtn = document.getElementById("picbed-view-library-btn");
    var uploadStatus = document.getElementById("picbed-upload-status");
    var uploadPreview = document.getElementById("picbed-upload-preview");

    var tabUploadBtn = document.getElementById("picbed-tab-upload");
    var tabLibraryBtn = document.getElementById("picbed-tab-library");
    var panelUpload = document.getElementById("picbed-panel-upload");
    var panelLibrary = document.getElementById("picbed-panel-library");

    var searchInput = document.getElementById("picbed-search-input");
    var libraryCategorySelect = document.getElementById("picbed-library-category");
    var searchBtn = document.getElementById("picbed-search-btn");
    var refreshBtn = document.getElementById("picbed-refresh-btn");
    var manageCategoriesBtn = document.getElementById("picbed-manage-categories-btn");
    var libraryStatus = document.getElementById("picbed-library-status");
    var libraryGrid = document.getElementById("picbed-library-grid");
    var categoryManager = document.getElementById("picbed-category-manager");
    var categoryManagerStatus = document.getElementById("picbed-category-manager-status");
    var categoryManagerList = document.getElementById("picbed-category-manager-list");
    var newCategoryIdInput = document.getElementById("picbed-new-category-id");
    var newCategoryNameInput = document.getElementById("picbed-new-category-name");
    var addCategoryBtn = document.getElementById("picbed-add-category-btn");

    var secretSection = document.getElementById("picbed-secret-section");
    var secretInput = document.getElementById("picbed-secret-input");
    var secretSaveBtn = document.getElementById("picbed-secret-save-btn");
    var secretClearBtn = document.getElementById("picbed-secret-clear-btn");
    var secretStatus = document.getElementById("picbed-secret-status");

    var currentUploadedItem = null;
    var libraryLoadedOnce = false;
    var libraryItems = [];
    var selectedFiles = [];
    var categories = [{ id: "root", name: "未分类", dir: "img" }];

    function setUploadStatus(html) { uploadStatus.innerHTML = html; }
    function setLibraryStatus(html) { libraryStatus.innerHTML = html; }
    function setCategoryManagerStatus(html) { categoryManagerStatus.innerHTML = html; }
    function getCategoryLabel(category) {
      if (category === "all") return "全部";
      var hit = categories.find(function (item) { return item.id === category; });
      return (hit && hit.name) ? hit.name : "未分类";
    }
    function normalizeCategories(items) {
      var map = {};
      (items || []).forEach(function (item) {
        if (!item || !item.id) return;
        map[item.id] = { id: String(item.id), name: String(item.name || item.id), dir: String(item.dir || "") };
      });
      map.root = { id: "root", name: "未分类", dir: (map.root && map.root.dir) ? map.root.dir : "img" };
      return Object.keys(map).map(function (key) { return map[key]; });
    }
    function getDefaultUploadCategory() {
      return categories.some(function (item) { return item.id === DEFAULT_UPLOAD_CATEGORY; }) ? DEFAULT_UPLOAD_CATEGORY : "root";
    }
    function buildApiMessage(data, fallback) {
      if (!data) return fallback;
      return data.error || data.message || data.detail || data.status || data.text || fallback;
    }
    function normalizeUploadErrorMessage(message) {
      var text = String(message || "");
      if (text.indexOf("File already exists") >= 0) {
        return "同名文件已存在，请重命名本地文件后再上传，或在图片库中重命名已有文件。";
      }
      return text || "未知错误";
    }

    function showDock() { dockPanel.style.display = "flex"; }
    function hideDock() { dockPanel.style.display = "none"; }
    function isDockVisible() { return dockPanel.style.display === "flex"; }
    function isInsideDock(node) { return !!(node && dockPanel && dockPanel.contains(node)); }

    function switchTab(tabName) {
      var showUpload = tabName === "upload";
      panelUpload.classList.toggle("active", showUpload);
      panelLibrary.classList.toggle("active", !showUpload);
      tabUploadBtn.classList.toggle("active", showUpload);
      tabLibraryBtn.classList.toggle("active", !showUpload);
      if (!showUpload && !libraryLoadedOnce) loadLibrary("");
    }

    function getMarkdownForItem(item, fallbackFilename) {
      var alt = filenameWithoutExt(item && item.filename ? item.filename : fallbackFilename);
      return "![" + alt + "](" + (item && item.url ? item.url : "") + ")";
    }

    function bindDragMarkdown(node, markdown) {
      if (!node) return;
      node.setAttribute("draggable", "true");
      node.addEventListener("dragstart", function (event) {
        if (!event || !event.dataTransfer) return;
        event.dataTransfer.setData("text/plain", markdown);
        event.dataTransfer.setData("text/markdown", markdown);
        event.dataTransfer.effectAllowed = "copy";
        var card = node.classList.contains("picbed-card") ? node : node.closest(".picbed-card");
        if (card) card.classList.add("dragging");
      });
      node.addEventListener("dragend", function () {
        var card = node.classList.contains("picbed-card") ? node : node.closest(".picbed-card");
        if (card) card.classList.remove("dragging");
      });
    }

    async function parseApiError(response) {
      var fallback = "HTTP " + response.status;
      try {
        var text = await response.text();
        if (!text) return fallback;
        try {
          var data = JSON.parse(text);
          return buildApiMessage(data, text || fallback);
        } catch (e) {
          return text || fallback;
        }
      } catch (e2) {
        return fallback;
      }
    }

    function getSecret() { return (sessionStorage.getItem(SECRET_STORAGE_KEY) || "").trim(); }
    function setSecret(value) { sessionStorage.setItem(SECRET_STORAGE_KEY, value); }
    function clearSecret() { sessionStorage.removeItem(SECRET_STORAGE_KEY); }

    function refreshSecretUI() {
      var secret = getSecret();
      if (secret) {
        secretInput.value = "";
        secretSection.style.display = "block";
        secretStatus.textContent = "密钥已保存到当前会话，可继续上传/管理。";
      } else {
        secretSection.style.display = "block";
        secretStatus.textContent = "未设置密钥，无法调用图床接口。";
      }
    }

    async function authFetch(url, options) {
      var secret = getSecret();
      if (!secret) throw new Error("请先输入图床管理密钥。");
      var opts = options || {};
      var headers = Object.assign({}, opts.headers || {}, { "X-Upload-Secret": secret });
      var resp = await fetch(url, Object.assign({}, opts, { headers: headers }));
      if (resp.status === 401) {
        clearSecret();
        refreshSecretUI();
        throw new Error("图床密钥错误或已失效，请重新输入。");
      }
      return resp;
    }

    function buildAltText(baseAlt, file, index, isMulti) {
      var trimmed = (baseAlt || "").trim();
      if (trimmed) return isMulti ? (trimmed + " " + (index + 1)) : trimmed;
      var byFile = filenameWithoutExt(file && file.name ? file.name : "");
      return (byFile || "").trim() || "图片";
    }

    function renderSelectedFiles() {
      if (!selectedFiles.length) {
        uploadPreview.innerHTML = "";
        return;
      }
      if (selectedFiles.length === 1) {
        uploadPreview.innerHTML = "<div class='picbed-row'>已选择 1 张：<strong>" + escapeHtml(selectedFiles[0].name || "未命名文件") + "</strong></div>";
        return;
      }
      var listHtml = selectedFiles.map(function (file, idx) {
        return "<li>" + (idx + 1) + ". " + escapeHtml(file.name || "未命名文件") + "</li>";
      }).join("");
      uploadPreview.innerHTML = "<div class='picbed-row'>已选择 <strong>" + selectedFiles.length + "</strong> 张图片：</div><ol style='margin:0;padding-left:20px;max-height:160px;overflow:auto;'>" + listHtml + "</ol>";
    }

    function renderCategorySelects() {
      var uploadValue = (uploadCategorySelect && uploadCategorySelect.value) || getDefaultUploadCategory();
      var libraryValue = (libraryCategorySelect && libraryCategorySelect.value) || DEFAULT_LIBRARY_CATEGORY;
      if (uploadCategorySelect) {
        uploadCategorySelect.innerHTML = categories.map(function (item) {
          return "<option value='" + escapeHtml(item.id) + "'>" + escapeHtml(item.name + " " + item.id) + "</option>";
        }).join("");
        uploadCategorySelect.value = categories.some(function (item) { return item.id === uploadValue; }) ? uploadValue : getDefaultUploadCategory();
      }
      if (libraryCategorySelect) {
        libraryCategorySelect.innerHTML = "<option value='all'>全部 all</option>" + categories.map(function (item) {
          return "<option value='" + escapeHtml(item.id) + "'>" + escapeHtml(item.name + " " + item.id) + "</option>";
        }).join("");
        libraryCategorySelect.value = (libraryValue === "all" || categories.some(function (item) { return item.id === libraryValue; })) ? libraryValue : "all";
      }
    }

    function renderCategoryManager() {
      if (!categoryManagerList) return;
      categoryManagerList.innerHTML = categories.map(function (item) {
        var disabled = item.id === "root";
        return "<div class='picbed-row' style='display:flex;gap:8px;align-items:center;flex-wrap:wrap;'>" +
          "<span style='min-width:90px;'>" + escapeHtml(item.id) + "</span>" +
          "<input type='text' data-cat-name='" + escapeHtml(item.id) + "' value='" + escapeHtml(item.name || "") + "' " + (disabled ? "disabled" : "") + " style='flex:1;min-width:160px;' />" +
          "<button type='button' data-cat-save='" + escapeHtml(item.id) + "' " + (disabled ? "disabled" : "") + ">保存</button>" +
          "<button type='button' class='ghost' data-cat-del='" + escapeHtml(item.id) + "' " + (disabled ? "disabled" : "") + ">删除</button>" +
          "</div>";
      }).join("");
    }

    async function reloadCategories(showErrorInStatus) {
      try {
        var resp = await authFetch(MEDIA_CATEGORIES_ENDPOINT);
        if (!resp.ok) throw new Error(await parseApiError(resp));
        var data = await resp.json();
        categories = normalizeCategories(data && data.items);
        renderCategorySelects();
        renderCategoryManager();
        if (showErrorInStatus) setLibraryStatus("分类加载成功。");
      } catch (e) {
        categories = normalizeCategories([{ id: "root", name: "未分类", dir: "img" }]);
        renderCategorySelects();
        renderCategoryManager();
        if (showErrorInStatus) setLibraryStatus("<span style='color:#b00020;'>分类加载失败，已回退为默认分类：root/all。原因：" + escapeHtml(e && e.message ? e.message : "未知错误") + "</span>");
      }
    }

    async function handleUpload() {
      if (!selectedFiles.length) return setUploadStatus("<span style='color:#b00020;'>请先选择图片文件。</span>");
      uploadBtn.disabled = true; uploadBtn.textContent = "上传中..."; setUploadStatus("正在上传，请稍候...");
      viewLibraryBtn.style.display = "none";
      try {
        var results = [];
        var successItems = [];
        for (var i = 0; i < selectedFiles.length; i++) {
          var file = selectedFiles[i];
          setUploadStatus("正在上传 " + (i + 1) + " / " + selectedFiles.length + "：" + escapeHtml(file.name || "未命名文件"));
          try {
            var formData = new FormData();
            formData.append("file", file);
            var uploadCategory = (uploadCategorySelect && uploadCategorySelect.value) || DEFAULT_UPLOAD_CATEGORY;
            var response = await authFetch(UPLOAD_ENDPOINT + "?category=" + encodeURIComponent(uploadCategory), { method: "POST", body: formData });
            if (!response.ok) throw new Error(await parseApiError(response));
            var data = await response.json();
            if (!data || !data.url) throw new Error("返回数据缺少 url");
            var alt = buildAltText(altInput.value || "", file, i, selectedFiles.length > 1);
            var markdown = "![" + alt + "](" + data.url + ")";
            var item = { status: "success", url: data.url || "", path: data.path || "", filename: data.filename || file.name || "", sha: data.sha || "", markdown: markdown, category: data.category || uploadCategory };
            results.push(item);
            successItems.push(item);
          } catch (itemError) {
            results.push({ status: "failed", filename: file.name || "", error: normalizeUploadErrorMessage(itemError && itemError.message ? itemError.message : "未知错误") });
          }
        }

        currentUploadedItem = successItems.length ? successItems[successItems.length - 1] : null;
        if (successItems.length) {
          viewLibraryBtn.style.display = "inline-block";
          if (libraryLoadedOnce) loadLibrary((searchInput.value || "").trim());
        }

        var resultHtml = results.map(function (item) {
          if (item.status === "success") {
            return "<div class='picbed-card' style='margin-top:8px;'>"
              + "<img class='picbed-thumb' draggable='true' src='" + escapeHtml(item.url) + "' alt='" + escapeHtml(item.filename || "image") + "' />"
              + "<div class='picbed-meta'><div>" + escapeHtml(item.filename || "(未命名)") + "</div><div><a href='" + escapeHtml(item.url) + "' target='_blank' rel='noopener'>" + escapeHtml(item.url) + "</a></div><div style='color:#666;'>分类：" + escapeHtml(getCategoryLabel(item.category) + " " + (item.category || "root")) + "</div><div style='color:#0a7b34;'>状态：成功</div></div>"
              + "<div style='color:#666;font-size:12px;margin-top:6px;'>拖拽图片到正文插入</div>"
              + "</div>";
          }
          return "<div class='picbed-card' style='margin-top:8px;'><div class='picbed-meta'><div>" + escapeHtml(item.filename || "(未命名)") + "</div><div style='color:#b00020;'>状态：失败</div><div style='color:#b00020;'>原因：" + escapeHtml(item.error || "未知错误") + "</div></div></div>";
        }).join("");

        uploadPreview.innerHTML = (successItems.length ? "<div class='picbed-row' style='color:#666;'>提示：上传后的图片可拖拽到正文插入。</div>" : "") + resultHtml;
        Array.prototype.slice.call(uploadPreview.querySelectorAll(".picbed-card")).forEach(function (card) {
          var link = card.querySelector(".picbed-meta a");
          var filenameNode = card.querySelector(".picbed-meta div");
          var markdown = getMarkdownForItem({
            url: link ? link.getAttribute("href") : "",
            filename: filenameNode ? filenameNode.textContent : ""
          }, "");
          if (!markdown) return;
          bindDragMarkdown(card, markdown);
          bindDragMarkdown(card.querySelector(".picbed-thumb"), markdown);
        });
        var summary = "<div>上传完成：成功 " + successItems.length + " 张，失败 " + (results.length - successItems.length) + " 张。</div>"
          + (successItems.length ? "<div>上传完成。可拖拽图片到正文插入。</div>" : "")
          + (successItems.length ? "<div>可切换到图片库查看。</div>" : "");
        setUploadStatus(summary);
      } catch (error) {
        safeWarn("Upload failed", error);
        setUploadStatus("<span style='color:#b00020;'>上传失败：" + escapeHtml(error && error.message ? error.message : "未知错误") + "</span>");
      } finally { uploadBtn.disabled = false; uploadBtn.textContent = "上传"; }
    }

    function renderLibrary(items) {
      libraryGrid.innerHTML = "";
      if (!items.length) { libraryGrid.innerHTML = "<div>暂无图片。</div>"; return; }
      items.forEach(function (item, index) {
        var card = document.createElement("div");
        card.className = "picbed-card";
        var md = getMarkdownForItem(item, item.filename);
        card.innerHTML = ""
          + "<img class='picbed-thumb' draggable='true' src='" + escapeHtml(item.url || "") + "' alt='" + escapeHtml(item.filename || "image") + "' />"
          + "<div class='picbed-meta'><div>" + escapeHtml(item.filename || "(未命名)") + "</div><div style='color:#666;'>" + formatSize(item.size) + "</div><div style='color:#666;'>分类：" + escapeHtml(getCategoryLabel(item.category) + " " + (item.category || "root")) + "</div></div>"
          + "<div style='color:#666;font-size:12px;margin-top:6px;'>拖拽图片到正文插入</div>"
          + "<div class='picbed-card-actions'>"
          + "<button type='button' class='ghost' data-act='rename'>重命名</button>"
          + "<button type='button' class='ghost' data-act='delete' " + (item.sha ? "" : "disabled") + ">删除</button>"
          + "</div>";
        bindDragMarkdown(card, md);
        bindDragMarkdown(card.querySelector(".picbed-thumb"), md);
        var btns = card.querySelectorAll("button");
        btns[0].onclick = async function () {
          var currentName = String(item.filename || "").trim();
          var newFilename = window.prompt("请输入新的文件名（包含后缀）", currentName);
          if (newFilename === null) return;
          newFilename = String(newFilename || "").trim();
          if (!newFilename) {
            setLibraryStatus("<span style='color:#b00020;'>文件名不能为空。</span>");
            return;
          }
          if (newFilename.indexOf("/") >= 0 || newFilename.indexOf("\\") >= 0) {
            setLibraryStatus("<span style='color:#b00020;'>文件名不能包含路径分隔符。</span>");
            return;
          }
          if (newFilename === currentName) return;
          try {
            btns[0].disabled = true;
            var renameResp = await authFetch(MEDIA_RENAME_ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: item.path, newFilename: newFilename })
            });
            if (!renameResp.ok) {
              if (renameResp.status === 409) throw new Error("目标文件名已存在");
              throw new Error(await parseApiError(renameResp));
            }
            var renameData = await renameResp.json();
            if (renameData && renameData.item) {
              libraryItems[index] = renameData.item;
              renderLibrary(libraryItems);
            }
            var refreshOk = await loadLibrary((searchInput.value || "").trim());
            if (refreshOk) {
              setLibraryStatus("<span>重命名成功。</span>");
            } else {
              setLibraryStatus("<span style='color:#b00020;'>重命名成功，但刷新失败，请稍后重试。</span>");
            }
          } catch (e) {
            btns[0].disabled = false;
            setLibraryStatus("<span style='color:#b00020;'>重命名失败：" + escapeHtml(e && e.message ? e.message : "未知错误") + "</span>");
          }
        };
        btns[1].onclick = async function () {
          if (!item.sha) return;
          var confirmed = window.confirm("确认删除这张图片？如果文章仍在引用它，会出现坏图。");
          if (!confirmed) return;
          try {
            btns[1].disabled = true;
            var resp = await authFetch(MEDIA_DELETE_ENDPOINT, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: item.path, sha: item.sha }) });
            if (!resp.ok) throw new Error(await parseApiError(resp));
            var deleteResult = await resp.json().catch(function () { return {}; });
            libraryItems.splice(index, 1);
            renderLibrary(libraryItems);
            setLibraryStatus("<span>删除成功。" + escapeHtml(deleteResult.detail || deleteResult.status || "") + "</span>");
          } catch (e) {
            btns[1].disabled = false;
            setLibraryStatus("<span style='color:#b00020;'>删除失败：" + escapeHtml(e && e.message ? e.message : "未知错误") + "</span>");
          }
        };
        libraryGrid.appendChild(card);
      });
    }

    async function loadLibrary(q) {
      setLibraryStatus("加载中...");
      libraryGrid.innerHTML = "";
      try {
        var libraryCategory = (libraryCategorySelect && libraryCategorySelect.value) || DEFAULT_LIBRARY_CATEGORY;
        var url = MEDIA_LIST_ENDPOINT + "?category=" + encodeURIComponent(libraryCategory) + "&limit=100" + (q ? "&q=" + encodeURIComponent(q) : "");
        var resp = await authFetch(url);
        if (!resp.ok) throw new Error(await parseApiError(resp));
        var data = await resp.json();
        libraryItems = Array.isArray(data.items) ? data.items : [];
        libraryLoadedOnce = true;
        setLibraryStatus("共 " + libraryItems.length + " 张图片。");
        renderLibrary(libraryItems);
        return true;
      } catch (e) {
        setLibraryStatus("<span style='color:#b00020;'>加载失败：" + escapeHtml(e && e.message ? e.message : "未知错误") + "</span>");
        return false;
      }
    }

    fab.addEventListener("pointerdown", function (event) {
      event.preventDefault();
    }, true);
    fab.addEventListener("mousedown", function (event) {
      event.preventDefault();
    }, true);
    fab.addEventListener("click", function () {
      if (isDockVisible()) {
        hideDock();
        return;
      }
      showDock(); refreshSecretUI(); switchTab("upload");
      reloadCategories(true).catch(function (e) { safeWarn("reloadCategories uncaught", e); });
    });
    dockCloseBtn.addEventListener("pointerdown", function (event) {
      event.preventDefault();
    }, true);
    dockCloseBtn.addEventListener("mousedown", function (event) {
      event.preventDefault();
    }, true);
    dockCloseBtn.addEventListener("click", hideDock);
    tabUploadBtn.addEventListener("click", function () { switchTab("upload"); });
    tabLibraryBtn.addEventListener("click", function () { switchTab("library"); });
    viewLibraryBtn.addEventListener("click", function () { switchTab("library"); });
    uploadBtn.addEventListener("click", function () { handleUpload().catch(function (e) { safeWarn("handleUpload uncaught", e); }); });
    function applyDockWidth(value) {
      if (window.innerWidth <= 768) return;
      var width = Math.min(720, Math.max(320, Number(value) || 420));
      dockPanel.style.width = width + "px";
    }
    var savedDockWidth = Number(localStorage.getItem(DOCK_WIDTH_STORAGE_KEY) || 0);
    if (savedDockWidth) applyDockWidth(savedDockWidth);
    dockResizer.addEventListener("mousedown", function (event) {
      if (window.innerWidth <= 768) return;
      event.preventDefault();
      var startX = event.clientX;
      var startWidth = dockPanel.offsetWidth;
      var oldSelect = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      function onMove(moveEvent) {
        var delta = startX - moveEvent.clientX;
        applyDockWidth(startWidth + delta);
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = oldSelect;
        localStorage.setItem(DOCK_WIDTH_STORAGE_KEY, String(dockPanel.offsetWidth));
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    secretSaveBtn.addEventListener("click", function () {
      var value = (secretInput.value || "").trim();
      if (!value) { secretStatus.textContent = "密钥不能为空。"; return; }
      setSecret(value);
      refreshSecretUI();
      secretStatus.textContent = "密钥已保存。";
    });
    secretClearBtn.addEventListener("click", function () {
      clearSecret();
      refreshSecretUI();
      setUploadStatus("<span>已清除图床密钥。</span>");
    });

    searchBtn.addEventListener("click", function () { loadLibrary((searchInput.value || "").trim()); });
    refreshBtn.addEventListener("click", function () { loadLibrary((searchInput.value || "").trim()); });
    searchInput.addEventListener("keydown", function (e) { if (e.key === "Enter") loadLibrary((searchInput.value || "").trim()); });
    manageCategoriesBtn.addEventListener("click", function () {
      var visible = categoryManager.style.display !== "none";
      categoryManager.style.display = visible ? "none" : "block";
      if (!visible) renderCategoryManager();
    });
    addCategoryBtn.addEventListener("click", async function () {
      var id = (newCategoryIdInput.value || "").trim();
      var name = (newCategoryNameInput.value || "").trim();
      if (!id || !name) return setCategoryManagerStatus("<span style='color:#b00020;'>分类 id 和名称不能为空。</span>");
      try {
        setCategoryManagerStatus("新增中...");
        var resp = await authFetch(MEDIA_CATEGORIES_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, name: name }) });
        if (!resp.ok) throw new Error(await parseApiError(resp));
        newCategoryIdInput.value = "";
        newCategoryNameInput.value = "";
        await reloadCategories(false);
        setCategoryManagerStatus("<span>分类新增成功。</span>");
      } catch (e) {
        setCategoryManagerStatus("<span style='color:#b00020;'>新增失败：" + escapeHtml(e && e.message ? e.message : "未知错误") + "</span>");
      }
    });
    categoryManagerList.addEventListener("click", async function (event) {
      var target = event.target;
      if (!target || target.tagName !== "BUTTON") return;
      var saveId = target.getAttribute("data-cat-save");
      var delId = target.getAttribute("data-cat-del");
      if (saveId && saveId !== "root") {
        var input = categoryManagerList.querySelector("input[data-cat-name='" + saveId + "']");
        var newName = (input && input.value ? input.value : "").trim();
        if (!newName) return setCategoryManagerStatus("<span style='color:#b00020;'>分类名称不能为空。</span>");
        try {
          setCategoryManagerStatus("保存中...");
          var saveResp = await authFetch(MEDIA_CATEGORIES_ENDPOINT, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: saveId, name: newName }) });
          if (!saveResp.ok) throw new Error(await parseApiError(saveResp));
          await reloadCategories(false);
          setCategoryManagerStatus("<span>分类名称已更新。</span>");
        } catch (e) {
          setCategoryManagerStatus("<span style='color:#b00020;'>保存失败：" + escapeHtml(e && e.message ? e.message : "未知错误") + "</span>");
        }
      }
      if (delId && delId !== "root") {
        if (!window.confirm("确认删除这个分类？只有空分类可以删除。")) return;
        try {
          setCategoryManagerStatus("删除中...");
          var delResp = await authFetch(MEDIA_CATEGORIES_ENDPOINT, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: delId }) });
          if (!delResp.ok) {
            var errText = await delResp.text();
            var errObj = null;
            try { errObj = JSON.parse(errText); } catch (eParse) { errObj = { text: errText }; }
            if (delResp.status === 409 && errObj && typeof errObj.count !== "undefined") {
              throw new Error("分类下还有 " + errObj.count + " 张图片，请先删除或移动图片后再删除分类。");
            }
            throw new Error(buildApiMessage(errObj, "删除失败"));
          }
          await reloadCategories(false);
          setCategoryManagerStatus("<span>分类已删除。</span>");
        } catch (e) {
          setCategoryManagerStatus("<span style='color:#b00020;'>删除失败：" + escapeHtml(e && e.message ? e.message : "未知错误") + "</span>");
        }
      }
    });
    if (uploadCategorySelect) uploadCategorySelect.value = getDefaultUploadCategory();
    if (libraryCategorySelect) {
      libraryCategorySelect.value = DEFAULT_LIBRARY_CATEGORY;
      libraryCategorySelect.addEventListener("change", function () { loadLibrary((searchInput.value || "").trim()); });
    }
    fileInput.addEventListener("change", function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      if (files.length > MAX_FILES_PER_UPLOAD) {
        setUploadStatus("<span style='color:#b00020;'>单次最多上传 15 张</span>");
      }
      selectedFiles = files.slice(0, MAX_FILES_PER_UPLOAD);
      renderSelectedFiles();
    });
  }

  function boot() {
    try { createUI(); } catch (e) { safeWarn("picbed manager init failed", e); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
