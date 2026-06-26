(() => {
  const forms = document.querySelectorAll(".gt-contact-form");
  if (!forms.length) return;

  const setStatus = (form, message, type = "") => {
    const note = form.querySelector("[data-contact-status]");
    if (!note) return;
    note.textContent = message;
    note.classList.toggle("is-success", type === "success");
    note.classList.toggle("is-error", type === "error");
  };

  forms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = form.querySelector("[type='submit']");
      const data = Object.fromEntries(new FormData(form).entries());

      submit?.setAttribute("disabled", "disabled");
      setStatus(form, "正在送出...");

      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "訊息暫時送不出去，請稍後再試。");
        }
        form.reset();
        setStatus(form, "收到了，我們會整理後儘快回覆。", "success");
      } catch (error) {
        setStatus(form, error.message || "訊息暫時送不出去，請稍後再試。", "error");
      } finally {
        submit?.removeAttribute("disabled");
      }
    });
  });
})();
