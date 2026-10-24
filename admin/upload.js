(() => {
  const uploadEndpoint = "https://blog-cms-oauth-dusky.vercel.app/api/upload";
  const secretStorageKey = "picbedUploadSecret";

  const fileInput = document.getElementById("fileInput");
  const secretInput = document.getElementById("secretInput");
  const rememberSecret = document.getElementById("rememberSecret");
  const clearSecretBtn = document.getElementById("clearSecretBtn");
  const uploadBtn = document.getElementById("uploadBtn");
  const copyBtn = document.getElementById("copyBtn");
  const result = document.getElementById("result");

  let latestUrl = "";

  function setResult(message, isError = false) {
    result.textContent = message;
    result.style.color = isError ? "#d93025" : "#1f1f1f";
  }

  function getStoredSecret() {
    return (sessionStorage.getItem(secretStorageKey) || "").trim();
  }

  function clearSecret() {
    sessionStorage.removeItem(secretStorageKey);
    secretInput.value = "";
    rememberSecret.checked = false;
  }

  const storedSecret = getStoredSecret();
  if (storedSecret) {
    secretInput.value = storedSecret;
    rememberSecret.checked = true;
  }

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files && fileInput.files[0];
    const secret = (secretInput.value || "").trim();

    if (!file) {
      setResult("请先选择一张图片。", true);
      return;
    }

    if (!secret) {
      setResult("请先输入图床管理密钥。", true);
      return;
    }

    if (rememberSecret.checked) {
      sessionStorage.setItem(secretStorageKey, secret);
    }

    const formData = new FormData();
    formData.append("file", file);

    uploadBtn.disabled = true;
    copyBtn.disabled = true;
    setResult("上传中，请稍候...");

    try {
      const response = await fetch(uploadEndpoint, {
        method: "POST",
        headers: {
          "X-Upload-Secret": secret,
        },
        body: formData,
      });

      if (response.status === 401) {
        clearSecret();
        throw new Error("图床密钥错误或已失效，请重新输入。");
      }

      if (!response.ok) {
        throw new Error(`上传失败：HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data || !data.url) {
        throw new Error("上传成功但未返回 url 字段。");
      }

      latestUrl = data.url;
      setResult(`上传成功：${latestUrl}`);
      copyBtn.disabled = false;
    } catch (error) {
      latestUrl = "";
      setResult(error.message || "上传失败，请稍后重试。", true);
    } finally {
      uploadBtn.disabled = false;
    }
  });

  clearSecretBtn.addEventListener("click", () => {
    clearSecret();
    setResult("已清除已保存密钥。", false);
  });

  copyBtn.addEventListener("click", async () => {
    if (!latestUrl) return;

    try {
      await navigator.clipboard.writeText(latestUrl);
      setResult(`已复制：${latestUrl}`);
    } catch (error) {
      setResult("复制失败，请手动复制上方链接。", true);
    }
  });
})();
